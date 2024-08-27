'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { LockIcon } from 'lucide-react'

type Props = {
  params: {
    id: string
  }
}

export default function JoinRoom({ params }: Props) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const handleJoin = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/join-room?roomId=${params.id}`, {
        method: 'POST',
      })
      if (response.ok) {
        router.push(`/chat/${params.id}`)
      } else {
        const error = await response.json()
        console.error('Failed to join room:', error)
        router.push(`/error?reason=${error.reason || 'unknown'}`)
      }
    } catch (error) {
      console.error('Error joining room:', error)
      router.push('/error?reason=unknown')
    }
    setIsLoading(false)
  }

  const handleDecline = () => {
    router.push('/')
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-6">
          <h1 className="text-3xl font-bold text-center mb-8 text-gray-800 tracking-tight">
            Join Secure Chat Room
          </h1>
          <p className="text-center mb-6">You've been invited to join a private chat room. Would you like to join?</p>
          <div className="flex justify-center space-x-4">
            <Button onClick={handleJoin} className="bg-green-500 hover:bg-green-700" disabled={isLoading}>
              {isLoading ? 'Joining...' : 'Join Chat'}
            </Button>
            <Button onClick={handleDecline} variant="destructive" className="bg-red-500 hover:bg-red-700">
              Decline
            </Button>
          </div>
        </CardContent>
      </Card>
      <div className="mt-8 flex items-center">
        <LockIcon className="w-4 h-4 mr-2" />
        <p className="text-sm text-gray-600">Simple, encrypted chats.</p>
      </div>
    </div>
  )
}