import type { CSSProperties } from 'react'

export interface IReactReaderStyle {
  container: CSSProperties
  readerArea: CSSProperties
  containerExpanded: CSSProperties
  titleArea: CSSProperties
  reader: CSSProperties
  swipeWrapper: CSSProperties
  prev: CSSProperties
  next: CSSProperties
  arrow: CSSProperties
  arrowHover: CSSProperties
}

export const ReactReaderStyle: IReactReaderStyle = {
  container: {
    overflow: 'hidden',
    position: 'relative',
    height: '100%',
  },
  readerArea: {
    position: 'relative',
    zIndex: 1,
    height: '100%',
    width: '100%',
    backgroundColor: '#fff',
    transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
  },
  containerExpanded: {
    transform: 'translateX(280px)',
  },
  titleArea: {
    position: 'absolute',
    top: 20,
    left: 50,
    right: 50,
    textAlign: 'center',
    color: '#999',
  },
  reader: {
    position: 'absolute',
    top: 50,
    left: 10,
    bottom: 10,
    right: 10,
  },
  swipeWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
    zIndex: 200,
  },
  prev: {
    left: 1,
  },
  next: {
    right: 1,
  },
  arrow: {
    outline: 'none',
    border: 'none',
    background: 'none',
    position: 'absolute',
    top: '50%',
    marginTop: -32,
    fontSize: 64,
    padding: '0 10px',
    color: '#E2E2E2',
    fontFamily: 'arial, sans-serif',
    cursor: 'pointer',
    userSelect: 'none',
    appearance: 'none',
    fontWeight: 'normal',
  },
  arrowHover: {
    color: '#777',
  },
}