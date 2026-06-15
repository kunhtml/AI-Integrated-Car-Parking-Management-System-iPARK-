export async function createNotification(_opts: { title: string; content: string; targetRole?: string }) {
  // stub: in real app push to notification system
  console.log("notification:", _opts.title);
}
