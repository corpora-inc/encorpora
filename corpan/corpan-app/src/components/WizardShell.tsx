// import { getPlatformTopPadding } from "./MainExperience";


function getPlatformTopPadding() {
    if (/iPhone|iPad|iPod|iOS/i.test(navigator.userAgent)) {
        return 50;
    } if (/Android/i.test(navigator.userAgent)) {
        return 12;
    }
    return 0;
}

function getPlatformBottomPadding() {
    if (/iPhone|iPad|iPod|iOS/i.test(navigator.userAgent)) {
        return 0;
    } if (/Android/i.test(navigator.userAgent)) {
        return 42;
    }
    return 0;
}

export function WizardShell({ children }: { children: React.ReactNode }) {
    return (
        // <div className="fixed inset-0 w-full h-full flex items-center justify-center bg-white md:bg-gray-50">
        <div
            className="fixed w-full h-full flex items-center justify-center bg-white md:bg-gray-50"
            // className="fixed w-full"
            style={{
                // position: "fixed",
                // top: "var(--inset-top)",
                // right: "var(--inset-right)",
                // bottom: "var(--inset-bottom)",
                // left: "var(--inset-left)",
                // top: 0,
                // bottom: -200,
                // height: "100lvh",
                // bottom: 100,
                // height: "calc(100lvh - var(--inset-top) - var(--inset-bottom))",
                // height: "100lvh",
                // marginBottom: "-500px",
                // overflow: "auto",
                // paddingTop: "var(--inset-top)",
                // paddingBottom: "500px",
                // marginBottom: "500px",
                // marginTop: "var(--inset-top)",
                // paddingTop: "50px",
                paddingTop: getPlatformTopPadding(),
                paddingBottom: getPlatformBottomPadding(),
            }}
        >
            <div
                className={`
                    w-full h-full flex flex-col items-center justify-center bg-white transition-all
                    rounded-none shadow-none
                    min-h-[500px] max-w-xl
                    md:shadow-2xl
                    sm:max-w-xl md:max-w-2xl lg:max-w-3xl xl:max-w-4xl
                    md:max-h-[830px] md:min-h-0 md:h-full
                    px-2
                `}
                // className="w-full h-full px-2"
                style={{
                    minHeight: 0,
                    height: "100%",
                    maxHeight: "100vh",
                }}
            // style={{
            //     // minHeight: "100dvh",
            //     // height: "1000px",
            //     // height: "100%",
            //     // Use the full viewport *minus* safe areas on iOS.
            //     // On Android/macOS these vars are 0, so nothing changes there.
            //     // maxHeight: "calc(100vh - var(--inset-top) - var(--inset-bottom))",
            //     // height: "max(100%, calc(100dvh - var(--inset-top) - var(--inset-bottom)))",
            //     // height: "100%",
            //     // maxHeight: "100dvh",
            //     // height: "max(100%, 100lvh)",
            //     // marginBottom: "-200px",
            //     // height: "calc(100lvh - var(--inset-top) - var(--inset-bottom))",
            //     // height: "100lvh",
            //     // paddingTop: "100px"
            //     // use the bottom safe area *inside* the wrapper
            //     // paddingBottom: "cal(var(--inset-bottom) * 10)",
            //     // then pull the wrapper back down so nothing visually shifts
            //     // marginBottom: "calc(var(--inset-bottom) * -5)",
            //     // marginBottom: "-300px",
            //     // paddingBottom: "300px",
            // }}
            >
                {children}
            </div>
        </div >
    );
}
