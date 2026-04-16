import * as React from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';

import { getYouTubeEmbedUrl } from '../lib/youtube';
import { theme } from '../theme';

const PLAYER_BASE_URL = 'https://nippard-plan.app';

type YouTubePlayerModalProps = {
  visible: boolean;
  videoTitle: string;
  videoUrl: string | null;
  videoNotes: string;
  onClose: () => void;
  onOpenInYouTube: () => void;
};

export function YouTubePlayerModal({
  visible,
  videoTitle,
  videoUrl,
  videoNotes,
  onClose,
  onOpenInYouTube,
}: YouTubePlayerModalProps) {
  const embedUrl = videoUrl ? getYouTubeEmbedUrl(videoUrl) : null;
  const notes = videoNotes.trim();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="fullScreen"
      transparent={false}
    >
      <SafeAreaView style={styles.screen}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>Exercise Demo</Text>
            <Text style={styles.title}>{videoTitle}</Text>
          </View>

          <Pressable onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>Close</Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.playerCard}>
            {embedUrl ? (
              Platform.OS === 'web' ? (
                <View style={styles.webPlayerFrame}>
                  {renderWebIframe(embedUrl, videoTitle)}
                </View>
              ) : (
                <WebView
                  style={styles.player}
                  source={{
                    html: createPlayerHtml(embedUrl, videoTitle),
                    baseUrl: PLAYER_BASE_URL,
                  }}
                  allowsInlineMediaPlayback
                  allowsFullscreenVideo
                  mediaPlaybackRequiresUserAction={false}
                  startInLoadingState
                  renderLoading={() => (
                    <View style={styles.loadingState}>
                      <ActivityIndicator color={theme.colors.accent} size="large" />
                    </View>
                  )}
                />
              )
            ) : (
              <View style={styles.errorState}>
                <Text style={styles.errorTitle}>Video unavailable in app</Text>
                <Text style={styles.errorBody}>
                  This link is not a supported YouTube video URL, so it can only be opened in
                  YouTube.
                </Text>

                <Pressable onPress={onOpenInYouTube} style={styles.secondaryButton}>
                  <Text style={styles.secondaryButtonText}>Open in YouTube</Text>
                </Pressable>
              </View>
            )}
          </View>

          {notes ? (
            <View style={styles.notesCard}>
              <Text style={styles.notesLabel}>Notes</Text>
              <Text style={styles.notesBody}>{notes}</Text>
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function renderWebIframe(embedUrl: string, videoTitle: string) {
  return React.createElement('iframe', {
    src: embedUrl,
    title: videoTitle,
    allow:
      'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share',
    allowFullScreen: true,
    referrerPolicy: 'strict-origin-when-cross-origin',
    style: {
      width: '100%',
      height: '100%',
      border: 0,
      borderRadius: '24px',
      backgroundColor: '#000000',
    },
  });
}

function createPlayerHtml(embedUrl: string, videoTitle: string) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover"
    />
    <style>
      html, body {
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
        background: #000;
        overflow: hidden;
      }

      iframe {
        width: 100%;
        height: 100%;
        border: 0;
      }
    </style>
  </head>
  <body>
    <iframe
      src="${embedUrl}"
      title="${escapeHtml(videoTitle)}"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowfullscreen
    ></iframe>
  </body>
</html>`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  content: {
    gap: 16,
    paddingBottom: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    paddingTop: 8,
    paddingBottom: 16,
  },
  headerCopy: {
    flex: 1,
    gap: 4,
  },
  eyebrow: {
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  title: {
    color: theme.colors.text,
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 30,
  },
  closeButton: {
    backgroundColor: theme.colors.surface,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  closeButtonText: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  playerCard: {
    minHeight: 240,
    aspectRatio: 16 / 9,
    backgroundColor: '#000000',
    borderRadius: theme.radii.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
  },
  player: {
    flex: 1,
    backgroundColor: '#000000',
  },
  webPlayerFrame: {
    flex: 1,
  },
  loadingState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
  },
  errorState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 12,
  },
  errorTitle: {
    color: theme.colors.accentText,
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  errorBody: {
    color: '#dbe7f5',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 420,
  },
  secondaryButton: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  secondaryButtonText: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  notesCard: {
    backgroundColor: theme.colors.canvas,
    borderRadius: theme.radii.md,
    padding: 14,
    gap: 4,
  },
  notesLabel: {
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  notesBody: {
    color: theme.colors.text,
    fontSize: 14,
    lineHeight: 22,
  },
});
