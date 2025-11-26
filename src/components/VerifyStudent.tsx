import { useState } from "react";
import { supabase } from "../lib/supabase";


export default function VerifyStudent() {
  const [studentId, setStudentId] = useState("");
  const [verified, setVerified] = useState<boolean | null>(null);

  const handleVerify = async () => {
    // Demo verification logic; replace with your real check
    const ok = studentId.trim() === "12345";
    setVerified(ok);
    if (!ok) return;

    // Mark the current user's profile as verified in Supabase
    const { data: userData } = await supabase.auth.getUser();
    const authUser = userData?.user;
    if (!authUser) return;

    await supabase
      .from('profiles')
      .update({ is_verified: true })
      .eq('id', authUser.id);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
      <h1 className="text-3xl font-bold mb-6">Verify Student</h1>

      <div className="bg-white shadow-xl rounded-2xl p-6 w-full max-w-md">
        <label className="block mb-2 text-sm font-medium text-gray-700">
          Enter Student ID
        </label>
        <input
          type="text"
          placeholder="e.g., 12345"
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
          className="border px-3 py-2 mb-4 rounded w-full"
        />
        <button
          onClick={handleVerify}
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition-colors"
        >
          Verify
        </button>

        {verified !== null && (
          <div
            className={`mt-4 text-center font-semibold ${
              verified ? "text-green-600" : "text-red-600"
            }`}
          >
            {verified ? "✅ Student verified! You’ll now be visible in Students directory." : "❌ Invalid ID"}
          </div>
        )}
      </div>
    </div>
  );
}
