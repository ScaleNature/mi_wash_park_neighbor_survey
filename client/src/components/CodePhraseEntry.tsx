import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Leaf, CheckCircle2, XCircle } from "lucide-react";

interface CodePhraseEntryProps {
  onValidCode: (parcelId: string) => void;
}

export default function CodePhraseEntry({ onValidCode }: CodePhraseEntryProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isChecking, setIsChecking] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsChecking(true);

    setTimeout(() => {
      if (password.toLowerCase().includes("oak")) {
        onValidCode("parcel-123");
      } else {
        setError("Invalid credentials. Please check and try again.");
      }
      setIsChecking(false);
    }, 500);
  };

  return (
    <Card className="w-full max-w-lg mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Leaf className="h-6 w-6 text-primary" />
        </div>
        <CardTitle>Access Survey</CardTitle>
        <CardDescription>
          Enter your street address and nature phrase to access the survey for your property.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="username">Street Address</Label>
            <Input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g., 123 Oak Street"
              className="mt-2"
              data-testid="input-username"
            />
          </div>
          <div>
            <Label htmlFor="password">Nature Phrase</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your unique nature phrase"
              className="mt-2"
              data-testid="input-password"
            />
            {error && (
              <div className="mt-2 flex items-center gap-2 text-sm text-destructive">
                <XCircle className="h-4 w-4" />
                <span>{error}</span>
              </div>
            )}
          </div>
          <Button
            type="submit"
            className="w-full"
            disabled={!username || !password || isChecking}
            data-testid="button-sign-in"
          >
            {isChecking ? (
              "Verifying..."
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Sign In
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
