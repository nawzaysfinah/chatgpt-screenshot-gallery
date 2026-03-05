import GalleryClient from "@/components/GalleryClient";
import { getAllConversations } from "@/lib/content/load";

export default async function HomePage() {
  const conversations = await getAllConversations();
  return <GalleryClient conversations={conversations} />;
}
