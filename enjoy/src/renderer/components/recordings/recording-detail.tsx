import {
  PronunciationAssessmentFulltextResult,
  PronunciationAssessmentScoreResult,
  WavesurferPlayer,
} from "@renderer/components";
import { Separator, ScrollArea } from "@renderer/components/ui";
import { useState } from "react";
import { Tooltip } from "react-tooltip";

export const RecordingDetail = (props: {
  recording: RecordingType;
  pronunciationAssessment?: PronunciationAssessmentType;
  onAssess?: (assessment: PronunciationAssessmentType) => void;
  onPlayOrigin?: (word: string, index: number) => void;
}) => {
  const { recording, onPlayOrigin } = props;
  if (!recording) return;

  const [pronunciationAssessment] = useState<PronunciationAssessmentType>(
    props.pronunciationAssessment || recording.pronunciationAssessment
  );
  const { result } = pronunciationAssessment || {};
  const [currentTime, setCurrentTime] = useState<number>(0);

  return (
    <div className="">
      <div className="flex justify-center mb-6">
        <WavesurferPlayer
          id={recording.id}
          src={recording.src}
          setCurrentTime={setCurrentTime}
        />
      </div>

      <Separator />

      {result ? (
        <PronunciationAssessmentFulltextResult
          className="py-4"
          words={result.words}
          currentTime={currentTime}
          src={recording.src}
          onPlayOrigin={onPlayOrigin}
        />
      ) : (
        <ScrollArea className="min-h-72 py-4 px-8 select-text">
          {(recording?.referenceText || "").split("\n").map((line, index) => (
            <div key={index} className="text-xl font-serif tracking-wide mb-2">
              {line}
            </div>
          ))}
        </ScrollArea>
      )}

      <Separator />

      <PronunciationAssessmentScoreResult
        pronunciationScore={pronunciationAssessment?.pronunciationScore}
        accuracyScore={pronunciationAssessment?.accuracyScore}
        fluencyScore={pronunciationAssessment?.fluencyScore}
        completenessScore={pronunciationAssessment?.completenessScore}
        prosodyScore={pronunciationAssessment?.prosodyScore}
      />

      <Tooltip id="recording-tooltip" />
    </div>
  );
};
