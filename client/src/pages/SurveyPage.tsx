import { useState } from "react";
import CodePhraseEntry from "@/components/CodePhraseEntry";
import SurveyForm, { SurveyData } from "@/components/SurveyForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function SurveyPage() {
  const [parcelId, setParcelId] = useState<string | null>(null);
  const [parcelData, setParcelData] = useState<any>(null);
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleValidCode = (id: string, parcel: any) => {
    setParcelId(id);
    setParcelData(parcel);
  };

  const handleSubmit = async (data: SurveyData) => {
    if (!parcelId) return;
    
    setIsSubmitting(true);
    try {
      await apiRequest("POST", `/api/parcels/${parcelId}/survey`, {
        address: data.address,
        q1Response: data.question1 === 'yes',
        q2Response: data.question2 === 'yes',
        q3Response: data.question3 === 'yes',
      });
      
      setSubmitted(true);
      toast({
        title: "Survey submitted",
        description: "Thank you for your participation!",
      });
    } catch (error: any) {
      toast({
        title: "Submission failed",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
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
        <SurveyForm 
          onSubmit={handleSubmit} 
          isSubmitting={isSubmitting}
          initialAddress={parcelData?.address}
          initialQ1={parcelData?.q1Response}
          initialQ2={parcelData?.q2Response}
          initialQ3={parcelData?.q3Response}
        />
      </div>
    </div>
  );
}
