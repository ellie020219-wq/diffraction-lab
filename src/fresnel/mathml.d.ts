import type { DetailedHTMLProps, HTMLAttributes } from 'react'

type MathProps = DetailedHTMLProps<HTMLAttributes<MathMLElement>, MathMLElement>

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      math: MathProps & { display?: 'block' | 'inline' }
      mfrac: MathProps
      mi: MathProps
      mn: MathProps
      mo: MathProps
      mrow: MathProps
      msub: MathProps
      msup: MathProps
      mtext: MathProps
    }
  }
}
