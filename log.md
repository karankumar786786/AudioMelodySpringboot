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
. Falling back to software encoding..