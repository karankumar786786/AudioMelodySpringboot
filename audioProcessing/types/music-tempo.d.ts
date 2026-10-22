declare module "music-tempo" {
    export default class MusicTempo {
        constructor(audioData: Float32Array | number[], params?: any);
        tempo: number;
        beats: number[];
        beatInterval: number;
    }
}
