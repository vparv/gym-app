import * as React from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { SafeAreaView } from 'react-native-safe-area-context';

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
  const { width } = useWindowDimensions();
  const isCompact = width < 430;
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
      <SafeAreaView edges={['top']} style={styles.screen}>
        <ScrollView
          contentContainerStyle={[styles.content, isCompact ? styles.contentCompact : undefined]}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.heroCard, isCompact ? styles.heroCardCompact : undefined]}>
            <View style={styles.header}>
              <View style={styles.headerCopy}>
                <Text style={styles.eyebrow}>Exercise Demo</Text>
                <Text style={[styles.title, isCompact ? styles.titleCompact : undefined]}>
                  {videoTitle}
                </Text>
                <Text style={styles.subtitle}>
                  Landscape video in a portrait view. Pinch to zoom if you want a closer look.
                </Text>
              </View>

              <View style={styles.headerActions}>
                <Pressable onPress={onOpenInYouTube} style={styles.openButton}>
                  <Text style={styles.openButtonText}>Open in YouTube</Text>
                </Pressable>
                <Pressable onPress={onClose} style={styles.closeButton}>
                  <Text style={styles.closeButtonText}>Close</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.playerStage}>
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

              {embedUrl ? (
                <View style={styles.playerHintRow}>
                  <Text style={styles.playerHintPill}>Pinch to zoom</Text>
                  <Text style={styles.playerHintText}>
                    The YouTube fullscreen button still works if you want the largest view.
                  </Text>
                </View>
              ) : null}
            </View>
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
      content="width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=4, user-scalable=yes, viewport-fit=cover"
    />
    <style>
      html, body {
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
        background: #000;
        overflow: auto;
        touch-action: pan-x pan-y pinch-zoom;
      }

      iframe {
        display: block;
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
    gap: 18,
    paddingTop: 12,
    paddingBottom: 20,
  },
  contentCompact: {
    gap: 14,
  },
  header: {
    gap: 14,
  },
  headerCopy: {
    gap: 6,
  },
  eyebrow: {
    color: theme.colors.accent,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  title: {
    color: theme.colors.text,
    fontSize: 30,
    fontWeight: '800',
    lineHeight: 36,
    letterSpacing: -0.6,
  },
  titleCompact: {
    fontSize: 25,
    lineHeight: 31,
  },
  subtitle: {
    color: theme.colors.muted,
    fontSize: 15,
    lineHeight: 23,
  },
  headerActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  heroCard: {
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.radii.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 20,
    gap: 18,
    shadowColor: theme.colors.shadow,
    shadowOffset: {
      width: 0,
      height: 14,
    },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 5,
  },
  heroCardCompact: {
    padding: 16,
    gap: 14,
  },
  openButton: {
    backgroundColor: theme.colors.accent,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 11,
    shadowColor: theme.colors.shadow,
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.14,
    shadowRadius: 12,
    elevation: 3,
  },
  openButtonText: {
    color: theme.colors.accentText,
    fontSize: 14,
    fontWeight: '800',
  },
  closeButton: {
    backgroundColor: theme.colors.surface,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  closeButtonText: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  playerStage: {
    backgroundColor: '#131820',
    borderRadius: theme.radii.xl,
    padding: 12,
    gap: 12,
    shadowColor: theme.colors.shadow,
    shadowOffset: {
      width: 0,
      height: 18,
    },
    shadowOpacity: 0.16,
    shadowRadius: 26,
    elevation: 6,
  },
  playerCard: {
    aspectRatio: 16 / 9,
    backgroundColor: '#000000',
    borderRadius: theme.radii.lg,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  player: {
    flex: 1,
    backgroundColor: '#000000',
  },
  webPlayerFrame: {
    flex: 1,
  },
  playerHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  playerHintPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.08)',
    color: '#ffffff',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  playerHintText: {
    flex: 1,
    color: '#d4d9e2',
    fontSize: 13,
    lineHeight: 20,
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
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 16,
    gap: 6,
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
