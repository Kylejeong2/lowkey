'use client'

import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { LockIcon } from 'lucide-react'
import Link from 'next/link'

export default function Home() {
  const [inviteLink, setInviteLink] = useState('')

  const generateInviteLink = () => {
    const randomId = Array.from({ length: 128 }, () => Math.random().toString(36).substring(2)).join('');
    setInviteLink(`${process.env.NEXT_PUBLIC_APP_URL}/join/${randomId}`)
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(inviteLink)
    // You might want to add a toast notification here
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-6">
          <h1 className="text-2xl font-bold text-center mb-6">Shh</h1>
          {!inviteLink ? (
            <div className="text-center">
              <p className="mb-4">Create a new chat room:</p>
              <Button onClick={generateInviteLink} className="w-full">
                Generate Invite Link
              </Button>
            </div>
          ) : (
            <div className="text-center">
              <p className="mb-4">Share this link with another user:</p>
              <div className="flex mb-4">
                <Input value={inviteLink} readOnly className="flex-grow" />
                <Button
                  onClick={() => {
                    copyToClipboard();
                    const button = document.activeElement as HTMLButtonElement;
                    const originalText = button.textContent;
                    button.textContent = 'Copied!';
                    setTimeout(() => {
                      button.textContent = originalText;
                    }, 2000);
                  }}
                  className="ml-2 bg-blue-500 hover:bg-blue-700"
                >
                  Copy
                </Button>
              </div>
              <div className="flex space-x-2">
                <Link href={inviteLink} className="flex-1">
                  <Button className="w-full">
                    Join Room
                  </Button>
                </Link>
                <Link href="/" className="flex-1">
                  <Button onClick={generateInviteLink} className="w-full bg-green-500 hover:bg-green-700">
                    Regenerate Room
                </Button>
                </Link>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      <div className="mt-8 flex items-center">
        <LockIcon className="w-4 h-4 mr-2" />
        <p className="text-sm text-gray-600">Simple, encrypted chats.</p>
      </div>
    </div>
  )
}