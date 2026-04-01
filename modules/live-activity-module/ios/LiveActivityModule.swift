import ExpoModulesCore
import ActivityKit

struct FocusTimerAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    var taskName: String
    var elapsedSeconds: Int
    var isPaused: Bool
    var startDate: Date?
  }
  var sessionId: String
}

public class LiveActivityModule: Module {
  public func definition() -> ModuleDefinition {
    Name("LiveActivityModule")

    AsyncFunction("startActivity") { (taskName: String, elapsedSeconds: Int, promise: Promise) in
      guard #available(iOS 16.2, *) else {
        promise.reject("UNSUPPORTED", "Live Activities require iOS 16.2+")
        return
      }
      guard ActivityAuthorizationInfo().areActivitiesEnabled else {
        promise.reject("DISABLED", "Live Activities are disabled on this device")
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
          promise.resolve(activity.id)
        } catch {
          promise.reject("START_FAILED", error.localizedDescription)
        }
      }
    }

    AsyncFunction("updateActivity") { (taskName: String, elapsedSeconds: Int, isPaused: Bool, promise: Promise) in
      guard #available(iOS 16.2, *) else { promise.resolve("unsupported"); return }
      Task {
        guard let activity = Activity<FocusTimerAttributes>.activities.first else {
          promise.resolve("no_activity"); return
        }
        let state = FocusTimerAttributes.ContentState(
          taskName: taskName,
          elapsedSeconds: elapsedSeconds,
          isPaused: isPaused,
          startDate: isPaused ? nil : Date().addingTimeInterval(-TimeInterval(elapsedSeconds))
        )
        await activity.update(ActivityContent(state: state, staleDate: nil))
        promise.resolve("updated")
      }
    }

    AsyncFunction("stopActivity") { (promise: Promise) in
      guard #available(iOS 16.2, *) else { promise.resolve("unsupported"); return }
      Task {
        for activity in Activity<FocusTimerAttributes>.activities {
          await activity.end(nil, dismissalPolicy: .after(.now + 2))
        }
        promise.resolve("stopped")
      }
    }
  }
}
