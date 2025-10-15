import SurveyForm from '../SurveyForm';

export default function SurveyFormExample() {
  return (
    <div className="max-w-2xl mx-auto p-6">
      <SurveyForm 
        onSubmit={(data) => console.log('Survey submitted:', data)}
      />
    </div>
  );
}
