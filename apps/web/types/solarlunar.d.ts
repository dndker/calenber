declare module "solarlunar" {
    type SolarDate = {
        cYear: number
        cMonth: number
        cDay: number
    }

    const solarlunar: {
        lunar2solar: (
            year: number,
            month: number,
            day: number,
            isLeapMonth: boolean
        ) => SolarDate
    }

    export default solarlunar
}
