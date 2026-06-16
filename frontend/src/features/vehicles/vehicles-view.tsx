"use client";

import { ScanLine } from "lucide-react";
import { DataTable } from "@/components/ui/data-table";

export function VehiclesView() {
    return (
        <div className="panel">
            <div className="panel-heading">
                <div>
                    <p>Phương tiện</p>
                    <h2>Xe đăng ký, blacklist và ngoại lệ</h2>  
                </div>
                <ScanLine size={22} />
            </div>
            <DataTable
                headers={["Biển số", "Loại phương tiện", "Trạng thái", "Thao tác"]}
                rows={registeredVehicles.map((vehicle) => [
                    vehicle.plate,
                    vehicle.owner,
                    vehicle.type,
                    vehicle.status,
                    <button className="small-button" key={vehicle.plate} onClick={() => approveVehicle(vehicle)} type="button"  
                    >
                        Duyệt
                    </button>
                ])}
            />
        </div>
    );
}