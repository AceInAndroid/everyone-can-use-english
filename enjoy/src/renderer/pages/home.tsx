import {
  AudiosSegment,
  AudibleBooksSegment,
  DocumentsSegment,
  VideosSegment,
  YoutubeVideosSegment,
} from "@renderer/components";

export default () => {
  const channels = ["@TED", "@CNN", "@nytimes"];

  return (
    <div className="w-full relative">
      <div className="max-w-5xl mx-auto px-4 py-6 lg:px-8">
        <div className="space-y-4">
          <AudiosSegment />
          <VideosSegment />
          <DocumentsSegment />
          <AudibleBooksSegment />
          {channels.map((channel) => (
            <YoutubeVideosSegment key={channel} channel={channel} />
          ))}
        </div>
      </div>
    </div>
  );
};
