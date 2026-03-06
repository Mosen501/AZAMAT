import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { useLanguage } from "@/lib/language";

export default function NotFound() {
  const { text, isArabic } = useLanguage();

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center bg-gray-50"
      dir={isArabic ? "rtl" : "ltr"}
    >
      <Card className="w-full max-w-md mx-4">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2">
            <AlertCircle className="h-8 w-8 text-red-500" />
            <h1 className="text-2xl font-bold text-gray-900">
              {text("404 Page Not Found", "404 الصفحة غير موجودة")}
            </h1>
          </div>

          <p className="mt-4 text-sm text-gray-600">
            {text(
              "The requested route is not available right now or has not been added to the router yet.",
              "المسار المطلوب غير متاح حاليا أو لم تتم إضافته إلى الموجّه.",
            )}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
