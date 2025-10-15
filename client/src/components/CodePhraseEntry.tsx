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
  const [codePhrase, setCodePhrase] = useState("");
  const [error, setError] = useState("");
  const [isChecking, setIsChecking] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsChecking(true);

    setTimeout(() => {
      if (codePhrase.toLowerCase().includes("oak")) {
        onValidCode("parcel-123");
      } else {
        setError("Invalid code phrase. Please check and try again.");
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
        <CardTitle>Enter Your Code Phrase</CardTitle>
        <CardDescription>
          Enter the unique nature-themed code phrase you received to access the survey for your property.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="code-phrase">Code Phrase</Label>
            <Input
              id="code-phrase"
              type="text"
              value={codePhrase}
              onChange={(e) => setCodePhrase(e.target.value)}
              placeholder="e.g., Woodland Trillium Bloom"
              className="mt-2 font-mono"
              data-testid="input-code-phrase"
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
            disabled={!codePhrase || isChecking}
            data-testid="button-verify-code"
          >
            {isChecking ? (
              "Verifying..."
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Verify Code
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
