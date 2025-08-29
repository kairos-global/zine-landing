import { SignIn } from "@clerk/nextjs";

export default function Page() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <SignIn />
    </div>
  );
}
