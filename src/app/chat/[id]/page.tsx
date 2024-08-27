import ChatComponent from '@/components/ChatComponent'

type Props = {
  params: {
    id: string
  }
}

export default function ChatPage({ params }: Props) {
  return <ChatComponent id={params.id} />
}