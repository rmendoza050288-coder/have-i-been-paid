# Have I Been Paid?

A modern, full-featured financial tracking application designed for freelancers, contractors, and gig workers to manage invoices, timecards, expenses, and payments all in one place.

## Features

### 📋 Invoice Management
- **Upload & Track Invoices**: Digitally store and organize all invoices with client information
- **OCR Extraction**: Automatically extract invoice details (company, amount, date, invoice number) from PDF/image uploads using AI vision
- **Payment Status**: Track which invoices are paid vs. unpaid
- **Google Drive Integration**: Securely store invoice files in Google Drive with automatic syncing

### ⏱️ Timecard Management  
- **Detailed Timecards**: Create comprehensive timecards with daily breakdowns
- **Multi-Rate Tracking**: Support for different pay rates and multipliers (1x, 1.5x, 2x hours)
- **Meal Penalties**: Track meal penalty violations
- **Mileage Tracking**: Log mileage for job sites (for tax deductions)
- **Digital Signatures**: Sign timecards with custom signature fonts

### 💼 Job Management
- **Project Tracking**: Create and organize jobs/projects
- **Job Classification**: Categorize roles (Data Wrangler, Digital Image Technician, etc.)
- **Link Timecards & Invoices**: Associate timecards and invoices with specific jobs

### 🛍️ Expense Management
- **Equipment Tracking**: Log equipment purchases with serial numbers and vendors
- **Expendable Supplies**: Track consumable supplies
- **Vehicle Expenses**: Record fuel, tires, maintenance, and other vehicle-related costs
- **Receipt Storage**: Attach receipts and photos to expense records

### 📊 Analytics & Insights
- **Payment Summary**: View all invoices and their payment status at a glance
- **Earnings Dashboard**: Track total earned, paid, and unpaid amounts
- **Expense Breakdown**: Categorize and analyze deductible expenses
- **Mileage Summary**: Calculate total mileage for tax reporting

---

## Tech Stack

- **Frontend**: React 18 with Next.js 14
- **Styling**: TailwindCSS + PostCSS
- **UI Components**: Custom components with Lucide React icons
- **Backend**: Next.js API Routes
- **Storage**: Google Drive API integration
- **AI/OCR**: OpenAI GPT-4o Vision (for invoice extraction)
- **Authentication**: Google Service Account (JWT-based)

---

## Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- Google Cloud Project with Drive API enabled
- OpenAI API key (optional, for OCR invoice extraction)

### Installation

1. **Clone the repository** (or navigate to the project directory):
   ```bash
   cd have-i-been-paid
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up environment variables** - Create a `.env.local` file:
   ```env
   # Google Drive API
   GOOGLE_SERVICE_ACCOUNT_JSON='{"type":"service_account","project_id":"...","private_key":"...","client_email":"..."}'
   
   # Optional: OpenAI API for invoice OCR
   OPENAI_API_KEY=sk-...
   ```

4. **Run the development server**:
   ```bash
   npm run dev
   ```

5. **Open in browser**:
   ```
   http://localhost:3000
   ```

### Production Deployment

Build and start the production server:
```bash
npm run build
npm start
```

---

## Usage

### Adding Invoices
1. Navigate to the Invoices section
2. Upload an invoice file (PDF or image)
3. The app will automatically extract key details if OCR is enabled
4. Review and edit extracted data as needed
5. Set payment status and save

### Creating Timecards
1. Go to Timecards section
2. Enter company, job name, and classification
3. Fill in daily call times, meal breaks, and work wrap times
4. System automatically calculates paid hours with proper multipliers
5. Add signature and save

### Tracking Expenses
1. Navigate to Purchases or Vehicle Expenses
2. Enter vendor, amount, category, and date
3. Upload receipt if available
4. Associate with a job (optional)
5. Save for tax deduction tracking

### Managing Jobs
1. Create a new job with name and classification
2. Link timecards and invoices to the job
3. Track all earnings and expenses per job
4. Use for project-based reporting

---

## API Endpoints

### Drive API
- `GET /api/drive` - Fetch files from Google Drive
- `POST /api/drive` - Upload files to Google Drive

### File Operations
- `GET /api/files` - List all stored files
- `DELETE /api/files/[id]` - Delete a file

### Invoice OCR
- `POST /api/extract` - Extract invoice data from image/PDF using AI

---

## Data Structure

All data is stored in `data.json` with the following collections:

```json
{
  "invoices": [...],
  "timecards": [...],
  "jobs": [...],
  "purchases": [...],
  "classifications": [...],
  "mileageLogs": [...],
  "vehicleExpenses": [...],
  "vehicles": [],
  "gasLogs": []
}
```

---

## Configuration

### Tailwind CSS
Custom configuration in `tailwind.config.js` for theme and styling.

### Next.js Configuration
See `next.config.js` for build and runtime configurations.

---

## Backup & Data Management

- **Local Backup**: Data is stored in `/offline_files/Have I Been Paid_/` directory
- **Google Drive Sync**: Files can be automatically backed up to Google Drive
- **Export Options**: Export invoices and timecards as needed

---

## Troubleshooting

### Google Drive Authentication Issues
- Verify your service account JSON credentials are correct
- Ensure the service account has Drive API permissions
- Check that `GOOGLE_SERVICE_ACCOUNT_JSON` environment variable is properly set

### OCR Not Working
- Ensure `OPENAI_API_KEY` is set in environment variables
- Verify OpenAI API account has credits
- Check that image/PDF quality is sufficient for OCR

### Data Not Persisting
- Verify `data.json` file exists and is writable
- Check file permissions on the data directory
- Ensure Google Drive sync is properly configured

---

## Contributing

This is a personal project. Feel free to fork and customize for your own use.

---

## License

This project is private and for personal use.

---

## Support

For issues or questions, refer to the application's error messages and logs. Check the browser console and server logs for debugging information.

---

**Built with ❤️ for tracking what you've earned**
