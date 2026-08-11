<<<<<<< Updated upstream
import { redirect } from "next/navigation";

export default function CameraLogsPage() {
  // /camera-logs đã được gộp vào /cameras — redirect vĩnh viễn
  redirect("/cameras");
}
=======
import { CamerasView } from "@/features/cameras/cameras-view";

export default function CameraLogsPage() {
  return <CamerasView />;
}
>>>>>>> Stashed changes
