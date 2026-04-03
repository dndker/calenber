import { AppSidebar } from "@/components/app-sidebar"
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbList,
    BreadcrumbPage,
} from "@workspace/ui/components/breadcrumb"
import { Button } from "@workspace/ui/components/button"
import { Separator } from "@workspace/ui/components/separator"
import {
    SidebarInset,
    SidebarProvider,
    SidebarTrigger,
} from "@workspace/ui/components/sidebar"
import { Ellipsis } from "lucide-react"

export default function Page() {
    return (
        <SidebarProvider>
            <AppSidebar />
            <SidebarInset>
                <header className="sticky top-0 flex h-16 shrink-0 items-center gap-2 border-b bg-background px-4">
                    <div className="flex shrink-0 items-center">
                        <SidebarTrigger className="-ml-1" />
                        <Separator
                            orientation="vertical"
                            className="mr-2 data-vertical:h-4 data-vertical:self-auto"
                        />
                    </div>
                    <div className="flex flex-1 items-center justify-between">
                        <Breadcrumb>
                            <BreadcrumbList>
                                <BreadcrumbItem>
                                    <BreadcrumbPage>
                                        October 2024
                                    </BreadcrumbPage>
                                </BreadcrumbItem>
                            </BreadcrumbList>
                        </Breadcrumb>
                        <div className="flex gap-1">
                            <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Submit"
                            >
                                <Ellipsis />
                            </Button>
                        </div>
                    </div>
                </header>
                <div className="flex flex-1 flex-col gap-4 p-4">
                    <div className="grid auto-rows-min gap-4 md:grid-cols-5">
                        {Array.from({ length: 20 }).map((_, i) => (
                            <div
                                key={i}
                                className="aspect-square rounded-xl bg-muted/50"
                            />
                        ))}
                    </div>
                </div>
            </SidebarInset>
        </SidebarProvider>
    )
}
