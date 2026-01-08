import { apiService } from './apiService';
import { supabase, handleSupabaseError } from './supabaseClient';

export const loyaltyService = {
  // Get customer loyalty membership with details
  getCustomerLoyalty: async (customerId) => {
    try {
      const membership = await apiService.get('customer_loyalty_memberships', {
        filters: { customer_id: customerId },
        select: `
          *,
          loyalty_programs (
            id,
            name,
            points_per_ugx,
            welcome_bonus_points,
            status
          ),
          loyalty_tiers (
            id,
            name,
            min_points,
            max_points,
            benefits,
            multiplier,
            tier_level
          )
        `,
        limit: 1
      });

      if (!membership.data || membership.data.length === 0) {
        // Create default membership if none exists
        return await this.createDefaultMembership(customerId);
      }

      return membership.data[0];
    } catch (error) {
      throw error;
    }
  },

  // Create default loyalty membership for new customer
  createDefaultMembership: async (customerId) => {
    try {
      // Get default loyalty program
      const programs = await apiService.get('loyalty_programs', {
        filters: { status: 'active' },
        limit: 1
      });

      if (!programs.data || programs.data.length === 0) {
        throw new Error('No active loyalty program found');
      }

      const program = programs.data[0];

      // Get bronze/basic tier (lowest tier)
      const tiers = await apiService.get('loyalty_tiers', {
        filters: { program_id: program.id },
        orderBy: { column: 'tier_level', ascending: true },
        limit: 1
      });

      const tier = tiers.data?.[0];

      // Create membership
      const membership = await apiService.post('customer_loyalty_memberships', {
        customer_id: customerId,
        program_id: program.id,
        tier_id: tier?.id || null,
        points_balance: program.welcome_bonus_points || 0,
        lifetime_points: program.welcome_bonus_points || 0,
        join_date: new Date().toISOString().split('T')[0],
        status: 'active'
      });

      // Add welcome bonus transaction if applicable
      if (program.welcome_bonus_points > 0) {
        await apiService.post('loyalty_point_transactions', {
          customer_id: customerId,
          transaction_type: 'earned',
          points: program.welcome_bonus_points,
          description: 'Welcome bonus points',
          transaction_date: new Date().toISOString()
        });
      }

      return {
        ...membership,
        loyalty_programs: program,
        loyalty_tiers: tier
      };
    } catch (error) {
      throw error;
    }
  },

  // Get loyalty point transactions (history)
  getPointTransactions: async (customerId, limit = 10) => {
    try {
      const transactions = await apiService.get('loyalty_point_transactions', {
        filters: { customer_id: customerId },
        orderBy: { column: 'transaction_date', ascending: false },
        limit: limit
      });

      return transactions.data || [];
    } catch (error) {
      throw error;
    }
  },

  // Add loyalty points for purchase
  addPointsForPurchase: async (customerId, orderAmount) => {
    try {
      // Get customer loyalty info
      const loyalty = await this.getCustomerLoyalty(customerId);
      if (!loyalty || !loyalty.loyalty_programs) {
        throw new Error('Customer loyalty program not found');
      }

      const pointsPerUgx = loyalty.loyalty_programs.points_per_ugx || 0.01;
      const multiplier = loyalty.loyalty_tiers?.multiplier || 1;
      
      const basePoints = Math.floor(orderAmount * pointsPerUgx);
      const bonusPoints = Math.floor(basePoints * (multiplier - 1));
      const totalPoints = basePoints + bonusPoints;

      if (totalPoints > 0) {
        // Create points transaction
        await apiService.post('loyalty_point_transactions', {
          customer_id: customerId,
          transaction_type: 'earned',
          points: totalPoints,
          description: `Points earned from purchase (UGX ${orderAmount})`,
          transaction_date: new Date().toISOString()
        });

        // Update membership balance
        const newBalance = loyalty.points_balance + totalPoints;
        const newLifetimePoints = loyalty.lifetime_points + totalPoints;

        await apiService.put('customer_loyalty_memberships', loyalty.id, {
          points_balance: newBalance,
          lifetime_points: newLifetimePoints
        });

        // Check for tier upgrade
        await this.checkTierUpgrade(customerId, newLifetimePoints);

        return {
          points_earned: totalPoints,
          new_balance: newBalance,
          base_points: basePoints,
          bonus_points: bonusPoints
        };
      }

      return { points_earned: 0, new_balance: loyalty.points_balance };
    } catch (error) {
      throw error;
    }
  },

  // Check and upgrade customer tier if eligible
  checkTierUpgrade: async (customerId, lifetimePoints) => {
    try {
      const loyalty = await this.getCustomerLoyalty(customerId);
      if (!loyalty) return;

      // Get all tiers for the program
      const tiers = await apiService.get('loyalty_tiers', {
        filters: { program_id: loyalty.program_id },
        orderBy: { column: 'tier_level', ascending: false }
      });

      // Find the highest tier the customer qualifies for
      const eligibleTier = tiers.data?.find(tier => 
        lifetimePoints >= tier.min_points && 
        (tier.max_points === null || lifetimePoints <= tier.max_points)
      );

      if (eligibleTier && eligibleTier.id !== loyalty.tier_id) {
        // Upgrade tier
        await apiService.put('customer_loyalty_memberships', loyalty.id, {
          tier_id: eligibleTier.id
        });

        // Create notification or transaction record
        await apiService.post('loyalty_point_transactions', {
          customer_id: customerId,
          transaction_type: 'tier_upgrade',
          points: 0,
          description: `Upgraded to ${eligibleTier.name} tier`,
          transaction_date: new Date().toISOString()
        });

        return eligibleTier;
      }

      return null;
    } catch (error) {
      throw error;
    }
  },

  // Redeem loyalty points
  redeemPoints: async (customerId, points, description = 'Points redemption') => {
    try {
      const loyalty = await this.getCustomerLoyalty(customerId);
      if (!loyalty) {
        throw new Error('Customer loyalty membership not found');
      }

      if (loyalty.points_balance < points) {
        throw new Error('Insufficient points balance');
      }

      // Create redemption transaction
      await apiService.post('loyalty_point_transactions', {
        customer_id: customerId,
        transaction_type: 'redemption',
        points: -Math.abs(points),
        description: description,
        transaction_date: new Date().toISOString()
      });

      // Update balance
      const newBalance = loyalty.points_balance - points;
      await apiService.put('customer_loyalty_memberships', loyalty.id, {
        points_balance: newBalance
      });

      return {
        points_redeemed: points,
        new_balance: newBalance,
        transaction_id: `RED-${Date.now()}`
      };
    } catch (error) {
      throw error;
    }
  },

  // Get available rewards based on customer's points
  getAvailableRewards: async (customerId) => {
    try {
      const loyalty = await this.getCustomerLoyalty(customerId);
      if (!loyalty) return [];

      // Define available rewards based on points balance
      const rewards = [
        {
          id: 1,
          title: 'Free Shipping',
          description: 'Get free shipping on your next order',
          points_required: 500,
          type: 'shipping',
          discount_value: 100, // percentage or fixed amount
          icon: '🚚',
          is_available: loyalty.points_balance >= 500
        },
        {
          id: 2,
          title: '10% Discount',
          description: '10% off your next purchase',
          points_required: 1000,
          type: 'discount',
          discount_value: 10,
          icon: '💰',
          is_available: loyalty.points_balance >= 1000
        },
        {
          id: 3,
          title: '15% Discount',
          description: '15% off your next purchase',
          points_required: 1500,
          type: 'discount',
          discount_value: 15,
          icon: '🎁',
          is_available: loyalty.points_balance >= 1500
        },
        {
          id: 4,
          title: 'VIP Access',
          description: 'Early access to new products and sales',
          points_required: 2000,
          type: 'access',
          discount_value: 0,
          icon: '👑',
          is_available: loyalty.points_balance >= 2000
        },
        {
          id: 5,
          title: 'Free Product',
          description: 'Get a free product worth up to UGX 50,000',
          points_required: 5000,
          type: 'product',
          discount_value: 50000,
          icon: '🎪',
          is_available: loyalty.points_balance >= 5000
        }
      ];

      return rewards;
    } catch (error) {
      throw error;
    }
  },

  // Get loyalty program statistics
  getLoyaltyStats: async (customerId) => {
    try {
      const loyalty = await this.getCustomerLoyalty(customerId);
      if (!loyalty) return null;

      // Get transaction stats
      const transactions = await this.getPointTransactions(customerId, 100);
      
      const earnedTransactions = transactions.filter(t => t.transaction_type === 'earned');
      const redeemedTransactions = transactions.filter(t => t.transaction_type === 'redemption');
      
      const totalEarned = earnedTransactions.reduce((sum, t) => sum + t.points, 0);
      const totalRedeemed = Math.abs(redeemedTransactions.reduce((sum, t) => sum + t.points, 0));

      // Calculate points until next tier
      const tiers = await apiService.get('loyalty_tiers', {
        filters: { program_id: loyalty.program_id },
        orderBy: { column: 'tier_level', ascending: true }
      });

      const currentTierIndex = tiers.data?.findIndex(t => t.id === loyalty.tier_id) || 0;
      const nextTier = tiers.data?.[currentTierIndex + 1];
      const pointsToNextTier = nextTier ? nextTier.min_points - loyalty.lifetime_points : 0;

      return {
        current_balance: loyalty.points_balance,
        lifetime_points: loyalty.lifetime_points,
        total_earned: totalEarned,
        total_redeemed: totalRedeemed,
        current_tier: loyalty.loyalty_tiers,
        next_tier: nextTier,
        points_to_next_tier: Math.max(0, pointsToNextTier),
        join_date: loyalty.join_date,
        transactions_count: transactions.length
      };
    } catch (error) {
      throw error;
    }
  }
};

export default loyaltyService;