import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Leaf, CheckCircle2, XCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface CodePhraseEntryProps {
  onValidCode: (parcelId: string, parcelData: any) => void;
}

export default function CodePhraseEntry({ onValidCode }: CodePhraseEntryProps) {
  const [parcelId, setParcelId] = useState("");
  const [codePhrase, setCodePhrase] = useState("");
  const [error, setError] = useState("");
  const [isChecking, setIsChecking] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsChecking(true);

    try {
      const res = await apiRequest("POST", "/api/parcels/verify", {
        parcelId,
        codePhrase,
      });
      const response: any = await res.json();
      
      if (response.success && response.parcel) {
        onValidCode(response.parcel.id, response.parcel);
      } else {
        setError("Invalid parcel ID or nature phrase. Please check and try again.");
      }
    } catch (err: any) {
      setError(err.message || "Verification failed. Please try again.");
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <Card className="w-full max-w-lg mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Leaf className="h-6 w-6 text-primary" />
        </div>
        <CardTitle>Sign In</CardTitle>
        <CardDescription>
          Enter your parcel ID and nature phrase to participate.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="parcel-id">Parcel ID</Label>
            <Input
              id="parcel-id"
              type="text"
              value={parcelId}
              onChange={(e) => setParcelId(e.target.value)}
              placeholder="e.g., P42.284198_-83.740703"
              className="mt-2"
              data-testid="input-parcel-id"
            />
          </div>
          <div>
            <Label htmlFor="code-phrase">Nature Phrase</Label>
            <Input
              id="code-phrase"
              type="password"
              value={codePhrase}
              onChange={(e) => setCodePhrase(e.target.value)}
              placeholder="Enter your unique nature phrase"
              className="mt-2"
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
            disabled={!parcelId || !codePhrase || isChecking}
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
