import { useState, useEffect } from 'react'
import './styles.css'
import Index from './components/Index/Index'
import Login from './components/Login/Login'

function App() {
  const [currentPage, setCurrentPage] = useState('index')

  useEffect(() => {
    const path = window.location.pathname
    if (path.includes('login')) {
      setCurrentPage('login')
    } else {
      setCurrentPage('index')
    }
  }, [])

  return (
    <>
      {currentPage === 'login' && <Login />}
      {currentPage === 'index' && <Index />}
    </>
  )
}

export default App
