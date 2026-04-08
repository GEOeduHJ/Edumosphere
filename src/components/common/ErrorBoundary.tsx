import React from 'react'

type State = { error: Error | null }

class ErrorBoundary extends React.Component<React.PropsWithChildren<{}>, State> {
  constructor(props: any) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: any) {
    // log to console for now
    // eslint-disable-next-line no-console
    console.error('Unhandled error in React tree:', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24 }}>
          <h2>앱 오류가 발생했습니다.</h2>
          <pre style={{ whiteSpace: 'pre-wrap', color: '#b91c1c' }}>{this.state.error.message}</pre>
          <details style={{ whiteSpace: 'pre-wrap' }}>
            {this.state.error.stack}
          </details>
          <div style={{ marginTop: 12 }}>
            <button onClick={() => window.location.reload()}>페이지 새로고침</button>
          </div>
        </div>
      )
    }
    return this.props.children as React.ReactElement
  }
}

export default ErrorBoundary
