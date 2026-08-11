import { redirect } from "next/navigation";

export default function CameraLogsPage() {
  // /camera-logs đã được gộp vào /cameras — redirect vĩnh viễn
  redirect("/cameras");
}