import { storage } from "@vendetta/plugin";
import { patcher, metro, commands } from "@vendetta";
import { findByStoreName, findByProps } from "@vendetta/metro";
import { React } from "@vendetta/metro/common";

// Initialize local storage structure
storage.trackedUsers ??= {}; // Format: { "userId": totalSeconds }
storage.targetList ??= [];   // Format: ["userId1", "userId2"] - Leave empty to track ALL users

const VoiceStateStore = findByStoreName("VoiceStateStore");
const UserStore = findByStoreName("UserStore");
const SelectedChannelStore = findByStoreName("SelectedChannelStore");

let trackerInterval = null;
const unpatches = [];

// Helper: Format seconds into readable duration (e.g., "12h 45m 10s")
function formatTime(totalSeconds) {
    if (!totalSeconds || totalSeconds <= 0) return "0s";
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    
    const parts = [];
    if (hrs > 0) parts.push(`${hrs}h`);
    if (mins > 0) parts.push(`${mins}m`);
    if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);
    return parts.join(" ");
}

// Core Tracking Loop
function startVoiceTracker() {
    if (trackerInterval) return;

    trackerInterval = setInterval(() => {
        const myId = UserStore.getCurrentUser()?.id;
        const currentVcId = SelectedChannelStore.getVoiceChannelId();

        // Only track if logged in and currently in a voice channel
        if (!myId || !currentVcId) return;

        const voiceStates = VoiceStateStore.getVoiceStatesForChannel(currentVcId) || {};
        const otherUserIds = Object.keys(voiceStates).filter(id => id !== myId);

        otherUserIds.forEach(userId => {
            // If targetList has items, only track those users. Otherwise, track everyone in VC.
            const isTargeted = storage.targetList.length === 0 || storage.targetList.includes(userId);
            if (isTargeted) {
                storage.trackedUsers[userId] = (storage.trackedUsers[userId] || 0) + 1;
            }
        });
    }, 1000);
}

function stopVoiceTracker() {
    if (trackerInterval) {
        clearInterval(trackerInterval);
        trackerInterval = null;
    }
}

export function onLoad() {
    startVoiceTracker();

    // Register Slash Command: /vctime
    unpatches.push(
        commands.registerCommand({
            name: "vctime",
            displayName: "vctime",
            description: "Check how long you've spent in VC with a user",
            options: [
                {
                    name: "user",
                    displayName: "user",
                    description: "The user to check",
                    type: 6, // USER type
                    required: true,
                }
            ],
            execute(args, ctx) {
                const targetId = args[0]?.value;
                const totalSeconds = storage.trackedUsers[targetId] || 0;
                const formatted = formatTime(totalSeconds);

                return {
                    content: `<@${targetId}>: Total VC time together: **${formatted}**`
                };
            }
        })
    );
}

export function onUnload() {
    stopVoiceTracker();
    unpatches.forEach(unpatch => unpatch?.());
}
