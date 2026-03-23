const DAY_START_HOUR = 8;
const DAY_END_HOUR = 18;
const SLOT_MINUTES = 30;

const ROW_HEIGHT = 48;

const timeSlots: string[] = [];
for (let h = DAY_START_HOUR; h < DAY_END_HOUR; h++) {
  timeSlots.push(`${h}:00`);
  timeSlots.push(`${h}:30`);
}

export const CALENDAR_ROW_HEIGHT = ROW_HEIGHT;
export const CALENDAR_DAY_START = DAY_START_HOUR;
export const CALENDAR_DAY_END = DAY_END_HOUR;
export const CALENDAR_SLOT_MINUTES = SLOT_MINUTES;
export const CALENDAR_ROW_COUNT = timeSlots.length;

export function TimeColumn() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minWidth: 56,
        flexShrink: 0,
      }}
    >
      <div
        style={{
          height: ROW_HEIGHT,
          borderBottom: "1px solid #eee",
          display: "flex",
          alignItems: "center",
          fontSize: 11,
          fontWeight: 700,
          color: "#888",
          paddingRight: 8,
          justifyContent: "flex-end",
        }}
      >
        Time
      </div>
      {timeSlots.map((time) => (
        <div
          key={time}
          style={{
            height: ROW_HEIGHT - 1,
            borderBottom: "1px solid #eee",
            display: "flex",
            alignItems: "center",
            fontSize: 12,
            color: "#666",
            paddingRight: 8,
            justifyContent: "flex-end",
          }}
        >
          {time}
        </div>
      ))}
    </div>
  );
}
