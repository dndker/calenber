import MonthView from "@/components/calendar/month-view"
import { generateMockEvents } from "@/lib/mock-event"

export default function Page() {
    const events = generateMockEvents()
    return <MonthView />
}
