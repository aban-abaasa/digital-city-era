import React, { useState, useEffect } from 'react'
import { testConnection } from '../services/supabase'

const SupabaseConnectionTest = () => {
  // const [connectionStatus, setConnectionStatus] = useState('Testing...')
  // const [isConnected, setIsConnected] = useState(null)

  // useEffect(() => {
  //   const checkConnection = async () => {
  //     try {
  //       setConnectionStatus('Testing connection...')
  //       const connected = await testConnection()
  //       
  //       if (connected) {
  //         setConnectionStatus('✅ Supabase connected successfully! Ready to create tables.')
  //         setIsConnected(true)
  //       } else {
  //         setConnectionStatus('❌ Supabase connection failed - Check your environment variables')
  //         setIsConnected(false)
  //       }
  //     } catch (error) {
  //       setConnectionStatus(`❌ Connection error: ${error.message}`)
  //       setIsConnected(false)
  //     }
  //   }

  //   checkConnection()
  // }, [])

  // const retestConnection = async () => {
  //   setConnectionStatus('Retesting...')
  //   setIsConnected(null)
  //   
  //   const connected = await testConnection()
  //   if (connected) {
  //     setConnectionStatus('✅ Supabase connected successfully! Ready to create tables.')
  //     setIsConnected(true)
  //   } else {
  //     setConnectionStatus('❌ Supabase connection failed - Check your environment variables')
  //     setIsConnected(false)
  //   }
  // }

  return (
    // <div style={{ 
    //   padding: '20px', 
    //   margin: '20px', 
    //   border: `2px solid ${isConnected ? 'green' : isConnected === false ? 'red' : 'orange'}`,
    //   borderRadius: '8px',
    //   backgroundColor: isConnected ? '#f0f8f0' : isConnected === false ? '#f8f0f0' : '#f8f8f0'
    // }}>
    //   <h3>🗄️ Supabase Database Connection</h3>
    //   <p><strong>Status:</strong> {connectionStatus}</p>
    //   <p><strong>Supabase URL:</strong> {import.meta.env.VITE_SUPABASE_URL || 'Not found'}</p>
    //   <p><strong>API Key:</strong> {import.meta.env.VITE_SUPABASE_ANON_KEY ? '✓ Present' : '❌ Missing'}</p>
    //   
    //   {isConnected && (
    //     <div style={{ 
    //       marginTop: '15px', 
    //       padding: '10px', 
    //       backgroundColor: '#e8f5e8', 
    //       borderRadius: '4px',
    //       fontSize: '14px' 
    //     }}>
    //       <p><strong>🎉 Great!</strong> Your Supabase connection is working perfectly.</p>
    //       <p>You can now create database tables and start building your application.</p>
    //     </div>
    //   )}

    //   <div style={{ marginTop: '15px' }}>
    //     <button 
    //       onClick={retestConnection}
    //       style={{
    //         padding: '10px 20px',
    //         backgroundColor: '#007bff',
    //         color: 'white',
    //         border: 'none',
    //         borderRadius: '4px',
    //         cursor: 'pointer',
    //         marginRight: '10px'
    //       }}
    //     >
    //       Test Connection Again
    //     </button>
    //     
    //     {isConnected && (
    //       <button 
    //         onClick={() => window.open(`${import.meta.env.VITE_SUPABASE_URL}/project/default/editor`, '_blank')}
    //         style={{
    //           padding: '10px 20px',
    //           backgroundColor: '#10b981',
    //           color: 'white',
    //           border: 'none',
    //           borderRadius: '4px',
    //           cursor: 'pointer'
    //         }}
    //       >
    //         Open Supabase Dashboard
    //       </button>
    //     )}
    //   </div>
    // </div>
    null
  )
}

export default SupabaseConnectionTest