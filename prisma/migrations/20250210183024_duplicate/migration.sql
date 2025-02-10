/*
  Warnings:

  - A unique constraint covering the columns `[employee_id,date]` on the table `Attendance` will be added. If there are existing duplicate values, this will fail.

*/
BEGIN TRY

BEGIN TRAN;

-- CreateIndex
ALTER TABLE [dbo].[Attendance] ADD CONSTRAINT [Attendance_employee_id_date_key] UNIQUE NONCLUSTERED ([employee_id], [date]);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
