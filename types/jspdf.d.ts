declare module "jspdf" {
    interface jsPDF {
        autoTable: (options: {
            head?: any[][]
            body?: any[][]
            startY?: number
            styles?: any
            headStyles?: any
            alternateRowStyles?: any
            columnStyles?: any
        }) => jsPDF
        lastAutoTable: { finalY: number }
    }
}

declare module "jspdf-autotable" {
    // This module extends jsPDF
}
