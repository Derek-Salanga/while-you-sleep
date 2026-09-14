import WidgetKit
import SwiftUI

// The anniversary widget shows the same "N days together" the app's HeroCard
// does, and it has to agree with it exactly.
//
// WHY THIS WIDGET NEEDS NO NETWORK, NO AUTH AND NO BACKGROUND REFRESH.
// "Days together" is a pure function of (anniversary date, today). The app
// writes the date once into the shared App Group container whenever it
// changes; from there the widget derives every future day's count on its own.
// So the timeline below can project forward and tick over at local midnight
// without the app ever running again -- no Supabase client in an extension,
// no token in the keychain, no refresh budget to spend.

private let appGroup = "group.com.whileyousleep.app"
private let anniversaryKey = "anniversaryDate"

// Matches src/theme/palette.ts. The left half of HeroCard is the *deepened*
// blue, not the base one: white on the base blue is 3.37:1, which fails for
// anything but the large count. On this it's 5.20:1, so the caption is legible
// too. Don't swap it back to the base hue to "match the brand" -- the brand
// file is where this value came from.
private let deepBlue = Color(red: 0x4F / 255, green: 0x63 / 255, blue: 0xD1 / 255)
private let dayOrange = Color(red: 0xFF / 255, green: 0xC6 / 255, blue: 0x70 / 255)

struct AnniversaryEntry: TimelineEntry {
    let date: Date
    // nil means no anniversary has been set yet -- rendered as a prompt rather
    // than as a zero, which would read as a real (and wrong) count.
    let daysTogether: Int?
    let since: String?
}

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> AnniversaryEntry {
        AnniversaryEntry(date: Date(), daysTogether: 365, since: "June 19, 2024")
    }

    func getSnapshot(in context: Context, completion: @escaping (AnniversaryEntry) -> Void) {
        completion(entry(for: Date()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<AnniversaryEntry>) -> Void) {
        let calendar = Calendar.current
        let startOfToday = calendar.startOfDay(for: Date())

        // One entry per local midnight. Fourteen is arbitrary but bounded:
        // WidgetKit asks for a fresh timeline at the end, which is also when a
        // changed anniversary would get picked up if the app never called
        // reloadAllTimelines() for some reason.
        var entries: [AnniversaryEntry] = []
        for dayOffset in 0..<14 {
            guard let day = calendar.date(byAdding: .day, value: dayOffset, to: startOfToday) else {
                continue
            }
            entries.append(entry(for: day))
        }

        completion(Timeline(entries: entries, policy: .atEnd))
    }

    private func entry(for date: Date) -> AnniversaryEntry {
        guard
            let stored = UserDefaults(suiteName: appGroup)?.string(forKey: anniversaryKey),
            let anniversary = parseDate(stored)
        else {
            return AnniversaryEntry(date: date, daysTogether: nil, since: nil)
        }

        let calendar = Calendar.current
        let days = calendar.dateComponents(
            [.day],
            from: calendar.startOfDay(for: anniversary),
            to: calendar.startOfDay(for: date)
        ).day

        return AnniversaryEntry(
            date: date,
            daysTogether: days,
            since: longDate(anniversary)
        )
    }

    // The stored value is a plain YYYY-MM-DD, and the app treats it as a local
    // calendar day (see daysBetween in src/lib/date.ts, which parses
    // `<date>T00:00:00` with no zone). Parsing it as UTC here would put the
    // widget a day out from the app for anyone west of Greenwich.
    private func parseDate(_ value: String) -> Date? {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.timeZone = TimeZone.current
        return formatter.date(from: value)
    }

    private func longDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .long
        formatter.timeStyle = .none
        return formatter.string(from: date)
    }
}

struct AnniversaryWidgetView: View {
    var entry: AnniversaryEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if let days = entry.daysTogether {
                // .serif echoes Fraunces, the app's display face. The real font
                // isn't bundled into this target yet -- see the note in
                // CLAUDE.md; doing so means adding the .ttf to the widget's own
                // resources, since an extension can't read the app's fonts.
                Text("\(days)")
                    .font(.system(size: 40, weight: .bold, design: .serif))
                    .foregroundStyle(.white)
                    .minimumScaleFactor(0.6)
                    .lineLimit(1)

                Text("days together")
                    .font(.system(size: 15, weight: .regular, design: .serif))
                    .italic()
                    .foregroundStyle(.white)

                Spacer(minLength: 8)

                // The partner hue only ever appears as a non-text accent here.
                // #FFC670 on this blue is about 3.4:1 -- fine for a bar, below
                // AA for type, and this app checks those pairings rather than
                // eyeballing them (src/theme/themes.test.ts).
                RoundedRectangle(cornerRadius: 2)
                    .fill(dayOrange)
                    .frame(width: 28, height: 4)

                if let since = entry.since {
                    Text("since \(since)")
                        .font(.system(size: 11))
                        .foregroundStyle(.white.opacity(0.85))
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
                        .padding(.top, 6)
                }
            } else {
                Text("While You Sleep")
                    .font(.system(size: 15, weight: .semibold, design: .serif))
                    .foregroundStyle(.white)
                Spacer(minLength: 8)
                Text("Set your anniversary in the app to start counting.")
                    .font(.system(size: 12))
                    .foregroundStyle(.white.opacity(0.85))
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .containerBackground(deepBlue, for: .widget)
    }
}

struct widget: Widget {
    let kind: String = "AnniversaryWidget"

    var body: some WidgetConfiguration {
        // StaticConfiguration, not AppIntentConfiguration: there is exactly one
        // pair and one anniversary, so there is nothing for a user to pick.
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            AnniversaryWidgetView(entry: entry)
        }
        .configurationDisplayName("Days together")
        .description("How long you and your partner have been together.")
        .supportedFamilies([.systemSmall])
    }
}

#Preview(as: .systemSmall) {
    widget()
} timeline: {
    AnniversaryEntry(date: .now, daysTogether: 482, since: "June 19, 2024")
    AnniversaryEntry(date: .now, daysTogether: nil, since: nil)
}
