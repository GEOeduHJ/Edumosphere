import React from 'react'

const EmptyState: React.FC<{ message?: string }> = ({ message = '데이터가 없습니다' }) => (
  <div className="empty">{message}</div>
)

export default EmptyState
