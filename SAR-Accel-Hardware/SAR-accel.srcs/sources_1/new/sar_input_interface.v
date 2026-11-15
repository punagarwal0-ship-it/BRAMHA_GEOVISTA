`timescale 1ns/1ps

// Accepts two synchronized row-major image streams and tags each accepted
// pixel pair with its coordinate. Counters advance only on a valid/ready
// transfer, so bubbles and downstream stalls do not lose alignment.
module sar_input_interface #(
    parameter IMAGE_WIDTH = 4,
    parameter IMAGE_HEIGHT = 4,
    parameter COORD_WIDTH = 16
) (
    input  wire                   clk,
    input  wire                   rst,
    input  wire                   start,
    input  wire                   valid_in,
    output wire                   ready_in,
    input  wire [7:0]             pixel1_in,
    input  wire [7:0]             pixel2_in,
    input  wire                   pixel_ready,
    output wire                   pixel_valid_out,
    output wire [7:0]             pixel1_out,
    output wire [7:0]             pixel2_out,
    output wire [COORD_WIDTH-1:0] x_out,
    output wire [COORD_WIDTH-1:0] y_out,
    output wire                   frame_last,
    output reg                    busy,
    output reg                    done
);
    reg [COORD_WIDTH-1:0] x_count;
    reg [COORD_WIDTH-1:0] y_count;
    wire transfer;
    wire last_pixel;

    assign ready_in       = busy && pixel_ready;
    assign pixel_valid_out = busy && valid_in;
    assign transfer       = pixel_valid_out && pixel_ready;
    assign last_pixel     = (x_count == IMAGE_WIDTH-1) &&
                            (y_count == IMAGE_HEIGHT-1);

    assign pixel1_out = pixel1_in;
    assign pixel2_out = pixel2_in;
    assign x_out = x_count;
    assign y_out = y_count;
    assign frame_last = transfer && last_pixel;

    always @(posedge clk) begin
        if (rst) begin
            x_count <= {COORD_WIDTH{1'b0}};
            y_count <= {COORD_WIDTH{1'b0}};
            busy    <= 1'b0;
            done    <= 1'b0;
        end else begin
            done <= 1'b0;

            if (!busy && start) begin
                x_count <= {COORD_WIDTH{1'b0}};
                y_count <= {COORD_WIDTH{1'b0}};
                busy    <= 1'b1;
            end else if (transfer) begin
                if (last_pixel) begin
                    busy <= 1'b0;
                    done <= 1'b1;
                end else if (x_count == IMAGE_WIDTH-1) begin
                    x_count <= {COORD_WIDTH{1'b0}};
                    y_count <= y_count + 1'b1;
                end else begin
                    x_count <= x_count + 1'b1;
                end
            end
        end
    end
endmodule
