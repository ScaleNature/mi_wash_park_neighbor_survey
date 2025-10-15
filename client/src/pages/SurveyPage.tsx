import { useState } from "react";
import CodePhraseEntry from "@/components/CodePhraseEntry";
import SurveyForm, { SurveyData } from "@/components/SurveyForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2 } from "lucide-react";

export default function SurveyPage() {
  const [parcelId, setParcelId] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleValidCode = (id: string) => {
    setParcelId(id);
  };

  const handleSubmit = (data: SurveyData) => {
    console.log('Survey submitted for parcel:', parcelId, data);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-6 bg-muted/30">
        <Card className="w-full max-w-lg text-center">
          <CardHeader>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <CheckCircle2 className="h-8 w-8 text-primary" />
            </div>
            <CardTitle>Thank You!</CardTitle>
            <CardDescription>
              Your response has been recorded. We appreciate your participation in supporting the health of Molin Nature Area.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!parcelId) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-6 bg-muted/30">
        <CodePhraseEntry onValidCode={handleValidCode} />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] p-6 bg-muted/30">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-serif font-bold mb-2">Neighborhood Support</h1>
          <p className="text-muted-foreground">
            Thank you for participating. Your responses help Park Stewards coordinate invasive species removal efforts.
          </p>
        </div>
        <SurveyForm onSubmit={handleSubmit} />
      </div>
    </div>
  );
}
