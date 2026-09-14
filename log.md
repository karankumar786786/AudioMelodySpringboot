ll uploads completed
--- Audio Transcoding Completed ---
Local transcoding directory cleaned up: /app/tmp/transcoded_audio_99306249-af14-4783-a053-94827b8935d6
[AUDIO-WORKER] Audio transcoding completed -> audios/75a73a2a-bdd0-4a01-bb5f-84897c441eaf (310.47s)
[CANVAS-WORKER] Downloading raw video for job 9eac705e-8fe9-4119-ac7e-495ec0afc9c6...
[CANVAS-WORKER] Cutting canvas snippet from 78s to 100s...
[CUT CANVAS] Clipping video snippet from 78s to 100s -> /app/tmp/canvas_fcaf08db-f105-4254-958d-6700aeaf55b1.mp4...
[HWACCEL] Primary encoder failed for canvas video clip: Command failed: ffmpeg -y -loglevel warning -ss 78 -t 22 -i /app/tmp/raw_video_canvas_fcaf08db-f105-4254-958d-6700aeaf55b1.mp4 -vf scale=w=1080:h=1920:force_original_aspect_ratio=increase,crop=1080:1920,format=yuv420p -c:v h264_nvenc -preset p4 -profile:v high -b:v 4000k -maxrate 5000k -bufsize 8000k -g 48 -keyint_min 48 -an -movflags +faststart /app/tmp/canvas_fcaf08db-f105-4254-958d-6700aeaf55b1.mp4
[h264_nvenc @ 0x57f463438580] Cannot load libcuda.so.1
[vost#0:0/h264_nvenc @ 0x57f463495940] Error while opening encoder - maybe incorrect parameters such as bit_rate, rate, width or height.
[vf#0:0 @ 0x57f463469100] Error sending frames to consumers: Operation not permitted
[vf#0:0 @ 0x57f463469100] Task finished with error code: -1 (Operation not permitted)
[vf#0:0 @ 0x57f463469100] Terminating thread with return code -1 (Operation not permitted)
[vost#0:0/h264_nvenc @ 0x57f463495940] Could not open encoder before EOF
[vost#0:0/h264_nvenc @ 0x57f463495940] Task finished with error code: -22 (Invalid argument)
[vost#0:0/h264_nvenc @ 0x57f463495940] Terminating thread with return code -22 (Invalid argument)
[out#0/mp4 @ 0x57f46343bc40] Nothing was written into output file, because at least one of its streams received no packets.
. Falling back to software encoding...
[VIDEO] Video audio track encoded -> /app/tmp/transcoded_video_3cfde4e7-9496-417b-b6af-6cc48c4be2d9/renditions/raw_video_audio.m4a
[HWACCEL] Software fallback succeeded for canvas video clip
[CUT CANVAS] Successfully cut canvas video snippet
[CANVAS-WORKER] Uploading canvas video to ImageKit...
[IMAGEKIT] Uploading canvas video to ImageKit folder "/songs/videos" as "75a73a2a-bdd0-4a01-bb5f-84897c441eaf_canvas.mp4"...
[IMAGEKIT] Uploaded canvas video successfully: /songs/videos/75a73a2a-bdd0-4a01-bb5f-84897c441eaf_canvas_sqOfuNYoj.mp4
[CANVAS-WORKER] Canvas processed successfully -> /songs/videos/75a73a2a-bdd0-4a01-bb5f-84897c441eaf_canvas_sqOfuNYoj.mp4
[AUDIO-WORKER] Video-only provided: downloading video and extracting audio track for job 9eac705e-8fe9-4119-ac7e-495ec0afc9c6...
[EXTRACT AUDIO] Extracting audio from /app/tmp/raw_video_extract_670d11ca-d0a3-4cd9-86bb-7a4ff2a2ad3e.mp4 -> /app/tmp/extracted_audio_670d11ca-d0a3-4cd9-86bb-7a4ff2a2ad3e.m4a...
Popped job from Redis queue: {"jobId":"4f112f0f-10fa-4e07-bdff-6d7b0ca5e4df"}
{
  jobId: "4f112f0f-10fa-4e07-bdff-6d7b0ca5e4df",
}
Successfully forwarded job event to Inngest
[EXTRACT AUDIO] Successfully extracted audio track
[AUDIO-WORKER] Transcoding and packaging multi-bitrate audio with hardware acceleration...
--- Starting Audio Transcoding Process ---
Input:  /app/tmp/extracted_audio_670d11ca-d0a3-4cd9-86bb-7a4ff2a2ad3e.m4a
Output: /app/tmp/transcoded_audio_670d11ca-d0a3-4cd9-86bb-7a4ff2a2ad3e
Duration: 296.51s — segment size: 4s
[AUDIO] Transcoding 3 profiles concurrently (concurrency=3, encoder=aac)...
[AUDIO] Transcoded profile -> 128kbps
[AUDIO] Transcoded profile -> 240kbps
[HWACCEL] Software fallback succeeded for canvas video clip
[CUT CANVAS] Successfully cut canvas video snippet
[CANVAS-WORKER] Uploading canvas video to ImageKit...
[IMAGEKIT] Uploading canvas video to ImageKit folder "/songs/videos" as "b39ffbfc-f4fb-4674-a590-c482257e9bbb_canvas.mp4"...
[IMAGEKIT] Uploaded canvas video successfully: /songs/videos/b39ffbfc-f4fb-4674-a590-c482257e9bbb_canvas_qYdF1aYfp.mp4
[CANVAS-WORKER] Canvas processed successfully -> /songs/videos/b39ffbfc-f4fb-4674-a590-c482257e9bbb_canvas_qYdF1aYfp.mp4
Fetched job details: {
  id: "4f112f0f-10fa-4e07-bdff-6d7b0ca5e4df",
  title: "Channe Ke Khet Mein",
  artistName: "Sushma Shrestha",
  duration: null,
  tempSongKey: "4d41e10b-56a1-48d5-8997-9144aac4953f",
  tempVideoKey: null,
  songKey: null,
  fullVideoKey: null,
  imageKey: "/songs/images/2925b666-643b-4d04-b2fd-e98007054f53_LTIZu7BGN.jpeg",
  videoKey: null,
  clipStartSec: null,
  clipEndSec: null,
  language: "Hindi",
  lrclibId: "18570610",
  songId: "51848d61-731b-4cf1-80d7-793403b40bd4",
  transcodingId: null,
  transcodingAttempt: 0,
  transcoded: false,
  savedInSearch: false,
  savedInRecommendation: false,
  isVideoReprocess: false,
  status: "PENDING",
}
[ORCHESTRATOR] Job 4f112f0f-10fa-4e07-bdff-6d7b0ca5e4df dispatching modular tasks:
  - Canvas task: false
  - Video task:  false
  - Audio task:  true
[AUDIO-WORKER] Downloading raw audio for job 4f112f0f-10fa-4e07-bdff-6d7b0ca5e4df...
[AUDIO] Transcoded profile -> 320kbps
Packaging with Shaka Packager...
[AUDIO-WORKER] Transcoding and packaging multi-bitrate audio with hardware acceleration...
--- Starting Audio Transcoding Process ---
Input:  /app/tmp/raw_audio_main_cf6c62d9-3a91-4e6c-9fb4-9be1460b8970
Output: /app/tmp/transcoded_audio_cf6c62d9-3a91-4e6c-9fb4-9be1460b8970
Duration: 359.66s — segment size: 4s
[AUDIO] Transcoding 3 profiles concurrently (concurrency=3, encoder=aac)...
MPD patched for VOD
Packaging complete
manage/signing-key`);
1448 | 			if (!sig) throw new Error(`No ${headerKeys.Signature} provided`);
                              ^
error: No x-inngest-signature provided
      at validateSignature (/app/node_modules/inngest/components/InngestCommHandler.js:1448:24)
      at handleAsyncRequest (/app/node_modules/inngest/components/InngestCommHandler.js:567:36)

{
  method: "GET",
}
Popped job from Redis queue: {"jobId":"d0223231-46e8-4275-ae18-9fb51c55566e"}
{
  jobId: "d0223231-46e8-4275-ae18-9fb51c55566e",
}
Successfully forwarded job event to Inngest
Fetched job details: {
  id: "d0223231-46e8-4275-ae18-9fb51c55566e",
  title: "Deewana Kar Raha Hai",
  artistName: "Javed Ali",
  duration: null,
  tempSongKey: null,
  tempVideoKey: "674da6aa-4bfe-4d5e-aed2-cb7089b85181",
  songKey: null,
  fullVideoKey: null,
  imageKey: "/songs/images/a0a70e2b-d375-4297-8e8c-b004489e9e3c_vcTtF3w_j.jpeg",
  videoKey: null,
  clipStartSec: 110,
  clipEndSec: 120,
  language: "Hindi",
  lrclibId: "34611812",
  songId: "02d5e75c-3d5a-47b6-96c9-6d7763433d77",
  transcodingId: null,
  transcodingAttempt: 0,
  transcoded: false,
  savedInSearch: false,
  savedInRecommendation: false,
  isVideoReprocess: false,
  status: "PENDING",
}
[ORCHESTRATOR] Job d0223231-46e8-4275-ae18-9fb51c55566e dispatching modular tasks:
  - Canvas task: true
  - Video task:  true
  - Audio task:  true
[CANVAS-WORKER] Downloading raw video for job d0223231-46e8-4275-ae18-9fb51c55566e...
[AUDIO-WORKER] Video-only provided: downloading video and extracting audio track for job d0223231-46e8-4275-ae18-9fb51c55566e...
[VIDEO-WORKER] Downloading raw video for job d0223231-46e8-4275-ae18-9fb51c55566e...
[CANVAS-WORKER] Cutting canvas snippet from 110s to 120s...
[CUT CANVAS] Clipping video snippet from 110s to 120s -> /app/tmp/canvas_b9663d5a-c2a0-434e-a7e8-e2599a41a1c2.mp4...
[HWACCEL] Detected Hardware Capabilities:
  - Platform: linux (2 cores)
  - Video Accelerator: NVIDIA NVENC (Hardware GPU) -> h264_nvenc
  - Audio Encoder: aac
  - Max Concurrency (Video: 2, Audio: 3)
[VIDEO-WORKER] Transcoding and packaging video with hardware acceleration...
--- Starting Video Transcoding & Shaka Packaging Process ---
Input:  /app/tmp/raw_video_main_1fcf29d8-f6ac-470c-ac72-c42ea6491507.mp4
Output: /app/tmp/transcoded_video_1fcf29d8-f6ac-470c-ac72-c42ea6491507
[EXTRACT AUDIO] Extracting audio from /app/tmp/raw_video_extract_6f7582be-1032-45a0-8776-fb54579c6185.mp4 -> /app/tmp/extracted_audio_6f7582be-1032-45a0-8776-fb54579c6185.m4a...
Video Info: 1920x1080, 359.12s, segment size: 4s
Selected profiles for packaging: [ "1080p", "720p", "480p", "360p" ]
[VIDEO] Transcoding 4 video renditions in parallel (concurrency=2, accelerator=NVIDIA NVENC (Hardware GPU))...
[VIDEO] Transcoding audio track for video package...
[VIDEO] Transcoding rendition -> 1080p (4500k)...
[VIDEO] Transcoding rendition -> 720p (2500k)...
[HWACCEL] Primary encoder failed for video rendition 1080p: Command failed: ffmpeg -y -loglevel warning -i /app/tmp/raw_video_main_1fcf29d8-f6ac-470c-ac72-c42ea6491507.mp4 -vf scale=w=1920:h=1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,format=yuv420p -c:v h264_nvenc -preset p4 -profile:v high -b:v 4500k -maxrate 5000k -bufsize 9000k -g 48 -keyint_min 48 -an /app/tmp/transcoded_video_1fcf29d8-f6ac-470c-ac72-c42ea6491507/renditions/raw_video_1080p.mp4
[h264_nvenc @ 0x5cc7084d5500] Cannot load libcuda.so.1
[vost#0:0/h264_nvenc @ 0x5cc7084fdf80] Error while opening encoder - maybe incorrect parameters such as bit_rate, rate, width or height.
[vf#0:0 @ 0x5cc708531bc0] Error sending frames to consumers: Operation not permitted
[vf#0:0 @ 0x5cc708531bc0] Task finished with error code: -1 (Operation not permitted)
[vf#0:0 @ 0x5cc708531bc0] Terminating thread with return code -1 (Operation not permitted)
[vost#0:0/h264_nvenc @ 0x5cc7084fdf80] Could not open encoder before EOF
[vost#0:0/h264_nvenc @ 0x5cc7084fdf80] Task finished with error code: -22 (Invalid argument)
[vost#0:0/h264_nvenc @ 0x5cc7084fdf80] Terminating thread with return code -22 (Invalid argument)
[out#0/mp4 @ 0x5cc708500d40] Nothing was written into output file, because at least one of its streams received no packets.
. Falling back to software encoding...
[HWACCEL] Primary encoder failed for video rendition 720p: Command failed: ffmpeg -y -loglevel warning -i /app/tmp/raw_video_main_1fcf29d8-f6ac-470c-ac72-c42ea6491507.mp4 -vf scale=w=1280:h=720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,format=yuv420p -c:v h264_nvenc -preset p4 -profile:v high -b:v 2500k -maxrate 3000k -bufsize 5000k -g 48 -keyint_min 48 -an /app/tmp/transcoded_video_1fcf29d8-f6ac-470c-ac72-c42ea6491507/renditions/raw_video_720p.mp4
[h264_nvenc @ 0x594b0a741500] Cannot load libcuda.so.1
[vost#0:0/h264_nvenc @ 0x594b0a769f80] Error while opening encoder - maybe incorrect parameters such as bit_rate, rate, width or height.
[vf#0:0 @ 0x594b0a79dbc0] Error sending frames to consumers: Operation not permitted
[vf#0:0 @ 0x594b0a79dbc0] Task finished with error code: -1 (Operation not permitted)
[vf#0:0 @ 0x594b0a79dbc0] Terminating thread with return code -1 (Operation not permitted)
[vost#0:0/h264_nvenc @ 0x594b0a769f80] Could not open encoder before EOF
[vost#0:0/h264_nvenc @ 0x594b0a769f80] Task finished with error code: -22 (Invalid argument)
[vost#0:0/h264_nvenc @ 0x594b0a769f80] Terminating thread with return code -22 (Invalid argument)
[out#0/mp4 @ 0x594b0a76cd40] Nothing was written into output file, because at least one of its streams received no packets.
. Falling back to software encoding...
[HWACCEL] Primary encoder failed for canvas video clip: Command failed: ffmpeg -y -loglevel warning -ss 110 -t 10 -i /app/tmp/raw_video_canvas_b9663d5a-c2a0-434e-a7e8-e2599a41a1c2.mp4 -vf scale=w=1080:h=1920:force_original_aspect_ratio=increase,crop=1080:1920,format=yuv420p -c:v h264_nvenc -preset p4 -profile:v high -b:v 4000k -maxrate 5000k -bufsize 8000k -g 48 -keyint_min 48 -an -movflags +faststart /app/tmp/canvas_b9663d5a-c2a0-434e-a7e8-e2599a41a1c2.mp4
[h264_nvenc @ 0x6420348eb580] Cannot load libcuda.so.1
[vost#0:0/h264_nvenc @ 0x6420349b1b40] Error while opening encoder - maybe incorrect parameters such as bit_rate, rate, width or height.
[vf#0:0 @ 0x6420349b8440] Error sending frames to consumers: Operation not permitted
[vf#0:0 @ 0x6420349b8440] Task finished with error code: -1 (Operation not permitted)
[vf#0:0 @ 0x6420349b8440] Terminating thread with return code -1 (Operation not permitted)
[vost#0:0/h264_nvenc @ 0x6420349b1b40] Could not open encoder before EOF
[vost#0:0/h264_nvenc @ 0x6420349b1b40] Task finished with error code: -22 (Invalid argument)
[vost#0:0/h264_nvenc @ 0x6420349b1b40] Terminating thread with return code -22 (Invalid argument)
[out#0/mp4 @ 0x6420348ee400] Nothing was written into output file, because at least one of its streams received no packets.
. Falling back to software encoding...
[VIDEO] Video audio track encoded -> /app/tmp/transcoded_video_1fcf29d8-f6ac-470c-ac72-c42ea6491507/renditions/raw_video_audio.m4a
[HWACCEL] Software fallback succeeded for canvas video clip
[CUT CANVAS] Successfully cut canvas video snippet
[CANVAS-WORKER] Uploading canvas video to ImageKit...
[IMAGEKIT] Uploading canvas video to ImageKit folder "/songs/videos" as "02d5e75c-3d5a-47b6-96c9-6d7763433d77_canvas.mp4"...
[IMAGEKIT] Uploaded canvas video successfully: /songs/videos/02d5e75c-3d5a-47b6-96c9-6d7763433d77_canvas_Jq0ksSrf0m.mp4
[CANVAS-WORKER] Canvas processed successfully -> /songs/videos/02d5e75c-3d5a-47b6-96c9-6d7763433d77_canvas_Jq0ksSrf0m.mp4
[EXTRACT AUDIO] Successfully extracted audio track
[AUDIO-WORKER] Transcoding and packaging multi-bitrate audio with hardware acceleration...
--- Starting Audio Transcoding Process ---
Input:  /app/tmp/extracted_audio_6f7582be-1032-45a0-8776-fb54579c6185.m4a
Output: /app/tmp/transcoded_audio_6f7582be-1032-45a0-8776-fb54579c6185
Duration: 359.23s — segment size: 4s
[AUDIO] Transcoding 3 profiles concurrently (concurrency=3, encoder=aac)...
[AUDIO] Transcoded profile -> 128kbps
[AUDIO] Transcoded profile -> 240kbps
[AUDIO] Transcoded profile -> 320kbps
Packaging with Shaka Packager...
MPD patched for VOD
Packaging complete
