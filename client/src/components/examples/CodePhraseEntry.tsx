import CodePhraseEntry from '../CodePhraseEntry';

export default function CodePhraseEntryExample() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-muted/30">
      <CodePhraseEntry onValidCode={(id) => console.log('Valid code for parcel:', id)} />
    </div>
  );
}
