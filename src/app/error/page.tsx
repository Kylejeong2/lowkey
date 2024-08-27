'use client'
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function ErrorPage() {
  const searchParams = useSearchParams();
  const reason = searchParams.get('reason');

  let errorMessage = 'An error occurred.';
  if (reason === 'room_full') {
    errorMessage = 'The room is full. Only two users are allowed per room.';
  } else if (reason === 'room_not_found') {
    errorMessage = 'The requested room does not exist.';
  } else if (reason === 'room_inactive') {
    errorMessage = 'This room has been inactive for too long and has been closed.';
  } else if (reason === 'chat_interrupted') {
    errorMessage = 'The chat was interrupted due to an unexpected number of users. Please generate a new URL and try again.';
  } else if (reason === 'invalid_room') {
    errorMessage = 'This is not a valid chatroom. Please check your link and try again.';
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
      <div className="bg-white p-8 rounded-lg shadow-md text-center">
        <h1 className="text-2xl font-bold mb-4">Error</h1>
        <p className="mb-6">{errorMessage}</p>
        <Link href="/">
          <Button>Return to Home</Button>
        </Link>
      </div>
    </div>
  );
}