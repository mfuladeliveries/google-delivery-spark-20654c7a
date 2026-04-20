/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({
  siteName,
  confirmationUrl,
}: InviteEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>You've been invited to join {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>You're invited to {siteName}</Heading>
        <Text style={text}>
          Tap the button below to accept your invitation and create your
          account.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Accept Invitation
        </Button>
        <Text style={footer}>
          If you weren't expecting this invitation, you can safely ignore this
          email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default InviteEmail

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
  margin: '0 0 28px',
}
const button = {
  backgroundColor: 'hsl(21, 100%, 50%)',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: 'bold' as const,
  borderRadius: '12px',
  padding: '14px 28px',
  textDecoration: 'none',
  display: 'inline-block',
}
const footer = {
  fontSize: '12px',
  color: 'hsl(0, 0%, 55%)',
  margin: '32px 0 0',
  borderTop: '1px solid hsl(0, 0%, 90%)',
  paddingTop: '16px',
}
