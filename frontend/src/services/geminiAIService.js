/**
 * Gemini AI Service - Product Identification
 * Uses Google's Gemini 2.5 Flash for visual product analysis
 * Called when barcode is not found in system
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { toast } from 'react-toastify';

class GeminiAIService {
  constructor() {
    this.client = null;
    this.apiKey = null;
    this.initialized = false;
  }

  /**
   * Initialize the Gemini AI client with API key
   * @param {string} apiKey - Google Gemini API key from environment
   */
  initialize(apiKey) {
    if (!apiKey) {
      console.warn('⚠️ Gemini API key not provided. AI features disabled.');
      this.initialized = false;
      return false;
    }
    
    try {
      this.apiKey = apiKey;
      this.client = new GoogleGenerativeAI(apiKey);
      this.initialized = true;
      console.log('✅ Gemini AI initialized');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Gemini AI:', error);
      this.initialized = false;
      return false;
    }
  }

  /**
   * Check if AI service is initialized
   */
  isInitialized() {
    return this.initialized && this.client !== null;
  }

  /**
   * Identify a product from image when barcode is not found
   * @param {Blob|string} imageData - Image blob or base64 string
   * @param {string} imageType - MIME type (e.g., 'image/jpeg')
   * @param {number} attemptNumber - Retry attempt number
   * @returns {Promise<Object>} Product details identified by AI
   */
  async identifyProduct(imageData, imageType = 'image/jpeg', attemptNumber = 1) {
    if (!this.isInitialized()) {
      throw new Error('Gemini AI not initialized. Check API key.');
    }

    try {
      console.log(`🤖 Analyzing image with Gemini AI (Attempt ${attemptNumber})...`);
      
      // Convert blob to base64 if needed
      let imageBase64 = imageData;
      if (imageData instanceof Blob) {
        imageBase64 = await this.blobToBase64(imageData);
      }

      // Creative system prompts that get more flexible with retries
      const systemPrompts = [
        // Attempt 1: ENHANCED - Focus on reading visible text, barcodes, and product details FIRST
        `You are a supermarket inventory AI expert specializing in product identification from images.
IMPORTANT: First, try to READ any visible text on the product (brand, product name, barcodes, labels).
Then extract:
1. Brand Name - READ if visible, or "Generic" if unclear
2. Product Name - READ visible text, include size/flavor/variant if shown
3. Barcode Number - If you can see a barcode, try to read the number
4. Category - Snacks, Beverages, Cleaning, Dairy, Personal Care, Electronics, Groceries, Household, Beauty, Health, Office, Other
5. Estimated Price - Based on packaging quality and typical market prices
6. Key Features - What's visible (organic, sugar-free, natural, premium, budget, etc.)
7. Package Size - If visible on packaging
8. Description - 2-3 word summary

Always return ONLY valid JSON: {"brand":"","barcode":"","productName":"","category":"","estimatedPrice":"","keyFeatures":[],"packageSize":"","description":""}`,

        // Attempt 2: More creative, focus on what you see
        `You are a creative product identifier. Even if you cannot read all text clearly, describe what you see:
- What is the dominant color or design?
- What type of product is this (food, cleaning, beauty, electronics)?
- Can you infer the brand from logos or colors?
- What is a reasonable product name based on the appearance?
- Estimate price based on packaging quality and type

Return JSON: {"brand":"","barcode":"","productName":"","category":"","estimatedPrice":"","keyFeatures":[],"packageSize":"","description":""}`,

        // Attempt 3: Ultra flexible - identify by any visible clue
        `Identify this product using ANY visible information:
- Logos, colors, text fragments, packaging style
- Similar products you know about
- Context clues from what is visible
- Make your best educated guess

Return JSON: {"brand":"Best guess","barcode":"","productName":"Product type + features visible","category":"Best category match","estimatedPrice":"Estimated range","keyFeatures":["Any visible feature"],"packageSize":"Any size info","description":"Simple description"}`
      ];

      const selectedPrompt = Math.min(attemptNumber - 1, systemPrompts.length - 1);
      
      const model = this.client.getGenerativeModel({ 
        model: "gemini-2.5-flash",
        systemInstruction: systemPrompts[selectedPrompt]
      });

      const response = await model.generateContent([
        {
          inlineData: {
            mimeType: imageType,
            data: imageBase64,
          },
        },
        "Analyze this product image. Be creative but accurate. Return ONLY valid JSON with no markdown."
      ]);

      const responseText = response.response.text();
      console.log(`🤖 AI Response (Attempt ${attemptNumber}):`, responseText);

      // Parse the JSON response
      const productDetails = this.parseAIResponse(responseText);
      
      if (productDetails) {
        console.log('✅ AI identified product:', productDetails);
        return {
          success: true,
          data: productDetails,
          method: 'ai',
          confidence: this.calculateConfidence(productDetails),
          attempt: attemptNumber
        };
      } else {
        throw new Error('Failed to parse AI response');
      }

    } catch (error) {
      console.error(`❌ AI identification error (Attempt ${attemptNumber}):`, error);
      throw error;
    }
  }

  /**
   * Calculate confidence score based on data completeness
   * @param {Object} productDetails - Parsed product details
   * @returns {number} Confidence score 0-100
   */
  calculateConfidence(productDetails) {
    let score = 0;
    const brand = productDetails.brand && productDetails.brand !== 'Unknown Brand';
    const name = productDetails.name && productDetails.name !== 'Unknown Product';
    const category = productDetails.category && productDetails.category !== 'General';
    const price = productDetails.estimatedPrice && productDetails.estimatedPrice !== '0';
    const features = productDetails.keyFeatures && productDetails.keyFeatures.length > 0;

    if (brand) score += 20;
    if (name) score += 25;
    if (category) score += 20;
    if (price) score += 20;
    if (features) score += 15;

    return Math.min(score, 100);
  }

  /**
   * Parse AI response and extract product details with smart fallbacks
   * @param {string} responseText - Raw response from Gemini
   * @returns {Object|null} Parsed product details or null
   */
  parseAIResponse(responseText) {
    try {
      // Multiple strategies to extract JSON
      let jsonString = responseText;

      // Strategy 1: Remove markdown code blocks
      jsonString = jsonString
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .replace(/`json\n?/g, '')
        .replace(/`\n?/g, '')
        .trim();

      // Strategy 2: Find JSON object if response contains extra text
      let jsonMatch = jsonString.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonString = jsonMatch[0];
      }

      // Strategy 3: Clean up common formatting issues
      jsonString = jsonString
        .replace(/\n/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      // Try to parse
      const parsed = JSON.parse(jsonString);

      return this.normalizeProductData(parsed);
    } catch (error) {
      console.error('⚠️ Failed to parse AI response, attempting recovery:', error);
      // Last resort: try to extract values from text
      return this.extractProductDataFromText(responseText);
    }
  }

  /**
   * Normalize product data from various AI response formats
   * @param {Object} parsed - Parsed JSON object
   * @returns {Object} Normalized product data
   */
  normalizeProductData(parsed) {
    return {
      brand: this.cleanString(parsed.brand || parsed.Brand || 'Unknown Brand'),
      barcode: this.cleanString(parsed.barcode || parsed.Barcode || ''), // NEW: Support barcode reading
      name: this.cleanString(parsed.productName || parsed.name || parsed.Product || 'Unknown Product'),
      category: this.cleanString(parsed.category || parsed.Category || 'General'),
      estimatedPrice: this.cleanString(parsed.estimatedPrice || parsed.price || parsed.Price || '0'),
      keyFeatures: Array.isArray(parsed.keyFeatures) ? parsed.keyFeatures : (parsed.features || []),
      packageSize: this.cleanString(parsed.packageSize || parsed.size || ''),
      description: this.cleanString(parsed.description || '')
    };
  }

  /**
   * Extract product data from plain text if JSON parsing fails
   * @param {string} text - Raw response text
   * @returns {Object} Extracted product data
   */
  extractProductDataFromText(text) {
    // Try to extract information from text using patterns
    const lines = text.split('\n').filter(line => line.trim());
    
    return {
      brand: this.extractValue(text, ['Brand:', 'brand:', 'Brand Name:', 'brand name:'], 'Unknown Brand'),
      barcode: this.extractValue(text, ['Barcode:', 'barcode:', 'Barcode Number:', 'barcode number:'], ''),
      name: this.extractValue(text, ['Product Name:', 'product name:', 'Name:', 'name:'], 'Unknown Product'),
      category: this.extractValue(text, ['Category:', 'category:'], 'General'),
      estimatedPrice: this.extractValue(text, ['Price:', 'price:', 'Estimated Price:', 'estimated price:'], '0'),
      keyFeatures: this.extractFeatures(text),
      packageSize: this.extractValue(text, ['Size:', 'size:', 'Package Size:', 'package size:'], ''),
      description: lines.length > 0 ? lines[0].substring(0, 100) : ''
    };
  }

  /**
   * Extract a value from text after a key
   * @param {string} text - Text to search
   * @param {Array} keys - Keys to look for
   * @param {string} defaultValue - Default if not found
   * @returns {string} Extracted value
   */
  extractValue(text, keys, defaultValue) {
    for (const key of keys) {
      const match = text.match(new RegExp(key + '\\s*(.+?)(?:\n|$)', 'i'));
      if (match && match[1]) {
        return this.cleanString(match[1]);
      }
    }
    return defaultValue;
  }

  /**
   * Extract features from text
   * @param {string} text - Text to search
   * @returns {Array} Extracted features
   */
  extractFeatures(text) {
    const features = [];
    const keywords = [
      'organic', 'natural', 'sugar-free', 'gluten-free', 'vegan', 'vegetarian',
      'premium', 'budget', 'eco-friendly', 'biodegradable', 'recyclable',
      'hypoallergenic', 'dermatologist-tested', 'cruelty-free', 'fair-trade'
    ];

    keywords.forEach(keyword => {
      if (text.toLowerCase().includes(keyword)) {
        features.push(keyword.charAt(0).toUpperCase() + keyword.slice(1));
      }
    });

    return features.length > 0 ? features : [];
  }

  /**
   * Clean string values
   * @param {string} value - Value to clean
   * @returns {string} Cleaned value
   */
  cleanString(value) {
    if (!value) return '';
    return String(value)
      .replace(/^[-\s:'"]+|[-\s:'"]+$/g, '')
      .trim()
      .substring(0, 200);
  }

  /**
   * Convert Blob to Base64 string
   * @param {Blob} blob - Image blob
   * @returns {Promise<string>} Base64 encoded string
   */
  blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Capture canvas frame as blob
   * @param {HTMLCanvasElement} canvas - Canvas element
   * @returns {Promise<Blob>} Canvas as blob
   */
  canvasToBlob(canvas) {
    return new Promise((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', 0.8);
    });
  }

  /**
   * Format AI product data for database insertion
   * @param {Object} aiData - Data from AI identification
   * @param {string} barcode - Scanned barcode (if available)
   * @returns {Object} Formatted product data
   */
  formatProductData(aiData, barcode = null) {
    const sku = barcode ? `SKU-${barcode.substring(0, 8)}` : `AI-${Date.now()}`;
    
    // Extract price range and use midpoint
    let costPrice = 0;
    let sellingPrice = 0;
    
    if (aiData.estimatedPrice && aiData.estimatedPrice !== '0') {
      const priceStr = aiData.estimatedPrice.toString();
      const prices = priceStr.split('-').map(p => parseInt(p.trim()) || 0);
      
      if (prices.length === 2) {
        sellingPrice = (prices[0] + prices[1]) / 2;
        costPrice = sellingPrice * 0.75; // Assume 25% margin
      } else if (prices[0] > 0) {
        sellingPrice = prices[0];
        costPrice = sellingPrice * 0.75;
      }
    }

    return {
      name: aiData.name,
      barcode: barcode || null,
      sku: sku,
      brand: aiData.brand,
      category: aiData.category,
      cost_price: Math.round(costPrice),
      selling_price: Math.round(sellingPrice),
      tax_rate: 18,
      description: `AI identified: ${aiData.keyFeatures.join(', ')}`,
      is_active: true
    };
  }
}

// Export singleton instance
export default new GeminiAIService();
