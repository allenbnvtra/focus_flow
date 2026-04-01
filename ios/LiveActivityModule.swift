import Foundation
import ActivityKit
import React

// ─── Re-declare the attributes in the main app target ────────────────────────
// The widget extension has its own copy — both must match exactly.

struct FocusTimerAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    var taskName: String
    var elapsedSeconds: Int
    var isPaused: Bool
    var startDate: Date?
  }
  var sessionId: String
}

// ─── Native module ────────────────────────────────────────────────────────────

@objc(LiveActivityModule)
class LiveActivityModule: NSObject {

  // ── Start ─────────────────────────────────────────────────────────────────

  @objc func startActivity(
    _ taskName: String,
    elapsedSeconds: NSInteger,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard #available(iOS 16.2, *) else {
      reject("UNSUPPORTED", "Live Activities require iOS 16.2+", nil)
      return
    }
    guard ActivityAuthorizationInfo().areActivitiesEnabled else {
      reject("DISABLED", "Live Activities are disabled", nil)
      return
    }

    Task {
      for activity in Activity<FocusTimerAttributes>.activities {
        await activity.end(nil, dismissalPolicy: .immediate)
      }

      let attributes = FocusTimerAttributes(sessionId: UUID().uuidString)
      let state = FocusTimerAttributes.ContentState(
        taskName: taskName,
        elapsedSeconds: elapsedSeconds,
        isPaused: false,
        startDate: Date().addingTimeInterval(-TimeInterval(elapsedSeconds))
      )

      do {
        let activity = try Activity<FocusTimerAttributes>.request(
          attributes: attributes,
          content: ActivityContent(state: state, staleDate: nil),
          pushType: nil
        )
        resolve(activity.id)
      } catch {
        reject("START_FAILED", error.localizedDescription, error)
      }
    }
  }

  // ── Update ────────────────────────────────────────────────────────────────

  @objc func updateActivity(
    _ taskName: String,
    elapsedSeconds: NSInteger,
    isPaused: Bool,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard #available(iOS 16.2, *) else { resolve("unsupported"); return }

    Task {
      guard let activity = Activity<FocusTimerAttributes>.activities.first else {
        resolve("no_activity"); return
      }
      let state = FocusTimerAttributes.ContentState(
        taskName: taskName,
        elapsedSeconds: elapsedSeconds,
        isPaused: isPaused,
        startDate: isPaused ? nil : Date().addingTimeInterval(-TimeInterval(elapsedSeconds))
      )
      await activity.update(ActivityContent(state: state, staleDate: nil))
      resolve("updated")
    }
  }

  // ── Stop ──────────────────────────────────────────────────────────────────

  @objc func stopActivity(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard #available(iOS 16.2, *) else { resolve("unsupported"); return }

    Task {
      for activity in Activity<FocusTimerAttributes>.activities {
        await activity.end(nil, dismissalPolicy: .after(.now + 2))
      }
      resolve("stopped")
    }
  }

  @objc static func requiresMainQueueSetup() -> Bool { false }
}
