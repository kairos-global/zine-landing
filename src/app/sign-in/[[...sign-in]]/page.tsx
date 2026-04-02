import { SignIn } from "@clerk/nextjs";

export default function Page() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#F0EBCC]/95 backdrop-blur-sm">
      <div className="relative w-full max-w-md">
        <SignIn
          appearance={{
            elements: {
              rootBox: "w-full",
              card: "shadow-xl border-2 border-black rounded-2xl bg-white/95",
              cardBox: "w-full",
            },
          }}
        />
      </div>
    </div>
  );
}
