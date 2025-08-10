declare module "jspdf-autotable" {
    interface AutoTableOptions {
        head?: any[][]
        body?: any[][]
        startY?: number
        styles?: any
        headStyles?: any
        alternateRowStyles?: any
        columnStyles?: any
        [key: string]: any
    }

    function autoTable(doc: any, options: AutoTableOptions): void

    export default autoTable
}

declare module "jspdf" {
    interface jsPDF {
        lastAutoTable?: {
            finalY: number
        }
    }
}
