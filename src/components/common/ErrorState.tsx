import React from 'react'

const ErrorState: React.FC<{ message?: string }> = ({ message = '오류가 발생했습니다' }) => (
  <div className="error">{message}</div>
)

export default ErrorState
