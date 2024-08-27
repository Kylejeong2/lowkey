import { NextResponse } from 'next/server';

// In-memory storage for room occupancy
const roomOccupancy = new Map<string, number>();

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url)
  const roomId = searchParams.get('roomId')

  if (!roomId) {
    return NextResponse.json({ error: 'Room ID is required' }, { status: 400 })
  }

  // Here you would typically check if the room exists and has less than 2 participants
  // For this example, we'll simulate this check
  const roomExists = true // Replace with actual room existence check
  const roomIsFull = false // Replace with actual room capacity check

  if (!roomExists) {
    return NextResponse.json({ error: 'Room not found', reason: 'room_not_found' }, { status: 404 })
  }

  if (roomIsFull) {
    return NextResponse.json({ error: 'Room is full', reason: 'room_full' }, { status: 403 })
  }

  // If everything is okay, return a success response
  return NextResponse.json({ success: true })
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const roomId = searchParams.get('roomId');

  if (!roomId) {
    return NextResponse.json({ error: 'Room ID is required' }, { status: 400 });
  }

  const occupancy = roomOccupancy.get(roomId) || 0;
  return NextResponse.json({ occupancy });
}
