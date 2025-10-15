import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2 } from "lucide-react";

import { Input } from "@/components/ui/input";

export interface SurveyData {
  address?: string;
  question1: 'yes' | 'no';
  question1Comment: string;
  question2: 'yes' | 'no';
  question2Comment: string;
  question3: 'yes' | 'no';
  question3Comment: string;
}

interface SurveyFormProps {
  onSubmit: (data: SurveyData) => void;
  isSubmitting?: boolean;
  initialAddress?: string | null;
  initialQ1?: boolean | null;
  initialQ2?: boolean | null;
  initialQ3?: boolean | null;
}

export default function SurveyForm({ onSubmit, isSubmitting = false, initialAddress, initialQ1, initialQ2, initialQ3 }: SurveyFormProps) {
  const [address, setAddress] = useState(initialAddress || '');
  const [q1, setQ1] = useState<'yes' | 'no' | ''>(initialQ1 === true ? 'yes' : initialQ1 === false ? 'no' : '');
  const [q1Comment, setQ1Comment] = useState('');
  const [q2, setQ2] = useState<'yes' | 'no' | ''>(initialQ2 === true ? 'yes' : initialQ2 === false ? 'no' : '');
  const [q2Comment, setQ2Comment] = useState('');
  const [q3, setQ3] = useState<'yes' | 'no' | ''>(initialQ3 === true ? 'yes' : initialQ3 === false ? 'no' : '');
  const [q3Comment, setQ3Comment] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (q1 && q2 && q3) {
      onSubmit({
        address: address || undefined,
        question1: q1,
        question1Comment: q1Comment,
        question2: q2,
        question2Comment: q2Comment,
        question3: q3,
        question3Comment: q3Comment,
      });
    }
  };

  const isValid = q1 && q2 && q3;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Property Information (Optional)</CardTitle>
          <CardDescription>
            Please provide your street address to help us coordinate with your property.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div>
            <Label htmlFor="address">Street Address</Label>
            <Input
              id="address"
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g., 123 Oak Street"
              className="mt-2"
              data-testid="input-address"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold">
              1
            </div>
            <div className="flex-1">
              <CardTitle className="text-lg">Invasive Species Removal Support</CardTitle>
              <CardDescription className="mt-2">
                I welcome Park Stewards to remove invasive species in Molin Nature Area near my property.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <RadioGroup value={q1} onValueChange={(v) => setQ1(v as 'yes' | 'no')}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="yes" id="q1-yes" data-testid="radio-q1-yes" />
              <Label htmlFor="q1-yes">Yes</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="no" id="q1-no" data-testid="radio-q1-no" />
              <Label htmlFor="q1-no">No</Label>
            </div>
          </RadioGroup>
          <div>
            <Label htmlFor="q1-comment">Comments (optional)</Label>
            <Textarea
              id="q1-comment"
              value={q1Comment}
              onChange={(e) => setQ1Comment(e.target.value)}
              placeholder="Any additional thoughts..."
              className="mt-2"
              data-testid="input-q1-comment"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold">
              2
            </div>
            <div className="flex-1">
              <CardTitle className="text-lg">Community Partnership</CardTitle>
              <CardDescription className="mt-2">
                As community partners, I understand that Park Stewards are available to assist me in the removal of the same species on my property, through either consultation, removal assistance, or donation based work.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <RadioGroup value={q2} onValueChange={(v) => setQ2(v as 'yes' | 'no')}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="yes" id="q2-yes" data-testid="radio-q2-yes" />
              <Label htmlFor="q2-yes">Yes</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="no" id="q2-no" data-testid="radio-q2-no" />
              <Label htmlFor="q2-no">No</Label>
            </div>
          </RadioGroup>
          <div>
            <Label htmlFor="q2-comment">Questions (optional)</Label>
            <Textarea
              id="q2-comment"
              value={q2Comment}
              onChange={(e) => setQ2Comment(e.target.value)}
              placeholder="Any questions or concerns..."
              className="mt-2"
              data-testid="input-q2-comment"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold">
              3
            </div>
            <div className="flex-1">
              <CardTitle className="text-lg">Compost Bin Sharing</CardTitle>
              <CardDescription className="mt-2">
                During the spring season, Park Stewards pull and compost bags of invasive species like Garlic Mustard and Dame's Rocket. I welcome Park Stewards to use my compost bin, as appropriate to more easily dispose of such material.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <RadioGroup value={q3} onValueChange={(v) => setQ3(v as 'yes' | 'no')}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="yes" id="q3-yes" data-testid="radio-q3-yes" />
              <Label htmlFor="q3-yes">Yes</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="no" id="q3-no" data-testid="radio-q3-no" />
              <Label htmlFor="q3-no">No</Label>
            </div>
          </RadioGroup>
          <div>
            <Label htmlFor="q3-comment">Comment (optional)</Label>
            <Textarea
              id="q3-comment"
              value={q3Comment}
              onChange={(e) => setQ3Comment(e.target.value)}
              placeholder="Any additional information..."
              className="mt-2"
              data-testid="input-q3-comment"
            />
          </div>
        </CardContent>
      </Card>

      <Button
        type="submit"
        disabled={!isValid || isSubmitting}
        className="w-full"
        data-testid="button-submit-survey"
      >
        {isSubmitting ? (
          "Submitting..."
        ) : (
          <>
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Submit Survey
          </>
        )}
      </Button>
    </form>
  );
}
