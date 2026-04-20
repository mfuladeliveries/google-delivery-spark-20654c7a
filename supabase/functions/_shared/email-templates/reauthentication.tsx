/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your verification code is {token}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Confirm it's you</Heading>
        <Text style={text}>Enter the code below to verify your identity:</Text>
        <Text style={codeStyle}>{token}</Text>
        <Text style={hint}>This code expires shortly.</Text>
        <Text style={footer}>
          If you didn't request this, you can safely ignore this email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

const main = {
  backgroundColor: '#ffffff',
  fontFamily: "'Inter', Arial, sans-serif",
}
const container = { padding: '32px 28px', maxWidth: '480px' }
const h1 = {
  fontSize: '24px',
  fontWeight: 'bold' as const,
  color: 'hsl(0, 0%, 10%)',
  margin: '0 0 20px',
}
const text = {
  fontSize: '15px',
  color: 'hsl(0, 0%, 30%)',
  lineHeight: '1.5',
  margin: '0 0 24px',
}
const codeStyle = {
  fontFamily: "'Courier New', Courier, monospace",
  fontSize: '36px',
  fontWeight: 'bold' as const,
  color: 'hsl(21, 100%, 50%)',
  letterSpacing: '0.4em',
  textAlign: 'center' as const,
  background: 'hsl(21, 100%, 96%)',
  padding: '20px',
  borderRadius: '12px',
  margin: '0 0 16px',
}
const hint = {
  fontSize: '13px',
  color: 'hsl(0, 0%, 50%)',
  textAlign: 'center' as const,
  margin: '0 0 32px',
}
const footer = {
  fontSize: '12px',
  color: 'hsl(0, 0%, 55%)',
  margin: '32px 0 0',
  borderTop: '1px solid hsl(0, 0%, 90%)',
  paddingTop: '16px',
}
